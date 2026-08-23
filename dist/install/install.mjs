#!/usr/bin/env tsx
import { createRequire as __acCreateRequire } from 'node:module'; const require = globalThis.require ?? __acCreateRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/yaml/dist/nodes/identity.js
var require_identity = __commonJS({
  "node_modules/yaml/dist/nodes/identity.js"(exports) {
    "use strict";
    var ALIAS = /* @__PURE__ */ Symbol.for("yaml.alias");
    var DOC = /* @__PURE__ */ Symbol.for("yaml.document");
    var MAP = /* @__PURE__ */ Symbol.for("yaml.map");
    var PAIR = /* @__PURE__ */ Symbol.for("yaml.pair");
    var SCALAR = /* @__PURE__ */ Symbol.for("yaml.scalar");
    var SEQ = /* @__PURE__ */ Symbol.for("yaml.seq");
    var NODE_TYPE = /* @__PURE__ */ Symbol.for("yaml.node.type");
    var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
    var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
    var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
    var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
    var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
    var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
    function isCollection(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case MAP:
          case SEQ:
            return true;
        }
      return false;
    }
    function isNode(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case ALIAS:
          case MAP:
          case SCALAR:
          case SEQ:
            return true;
        }
      return false;
    }
    var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;
    exports.ALIAS = ALIAS;
    exports.DOC = DOC;
    exports.MAP = MAP;
    exports.NODE_TYPE = NODE_TYPE;
    exports.PAIR = PAIR;
    exports.SCALAR = SCALAR;
    exports.SEQ = SEQ;
    exports.hasAnchor = hasAnchor;
    exports.isAlias = isAlias;
    exports.isCollection = isCollection;
    exports.isDocument = isDocument;
    exports.isMap = isMap;
    exports.isNode = isNode;
    exports.isPair = isPair;
    exports.isScalar = isScalar;
    exports.isSeq = isSeq;
  }
});

// node_modules/yaml/dist/visit.js
var require_visit = __commonJS({
  "node_modules/yaml/dist/visit.js"(exports) {
    "use strict";
    var identity = require_identity();
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove node");
    function visit(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        visit_(null, node, visitor_, Object.freeze([]));
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    function visit_(key, node, visitor, path19) {
      const ctrl = callVisitor(key, node, visitor, path19);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path19, ctrl);
        return visit_(key, ctrl, visitor, path19);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path19 = Object.freeze(path19.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = visit_(i, node.items[i], visitor, path19);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path19 = Object.freeze(path19.concat(node));
          const ck = visit_("key", node.key, visitor, path19);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = visit_("value", node.value, visitor, path19);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    async function visitAsync(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        await visitAsync_(null, node, visitor_, Object.freeze([]));
    }
    visitAsync.BREAK = BREAK;
    visitAsync.SKIP = SKIP;
    visitAsync.REMOVE = REMOVE;
    async function visitAsync_(key, node, visitor, path19) {
      const ctrl = await callVisitor(key, node, visitor, path19);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path19, ctrl);
        return visitAsync_(key, ctrl, visitor, path19);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path19 = Object.freeze(path19.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = await visitAsync_(i, node.items[i], visitor, path19);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path19 = Object.freeze(path19.concat(node));
          const ck = await visitAsync_("key", node.key, visitor, path19);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = await visitAsync_("value", node.value, visitor, path19);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    function initVisitor(visitor) {
      if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
        return Object.assign({
          Alias: visitor.Node,
          Map: visitor.Node,
          Scalar: visitor.Node,
          Seq: visitor.Node
        }, visitor.Value && {
          Map: visitor.Value,
          Scalar: visitor.Value,
          Seq: visitor.Value
        }, visitor.Collection && {
          Map: visitor.Collection,
          Seq: visitor.Collection
        }, visitor);
      }
      return visitor;
    }
    function callVisitor(key, node, visitor, path19) {
      if (typeof visitor === "function")
        return visitor(key, node, path19);
      if (identity.isMap(node))
        return visitor.Map?.(key, node, path19);
      if (identity.isSeq(node))
        return visitor.Seq?.(key, node, path19);
      if (identity.isPair(node))
        return visitor.Pair?.(key, node, path19);
      if (identity.isScalar(node))
        return visitor.Scalar?.(key, node, path19);
      if (identity.isAlias(node))
        return visitor.Alias?.(key, node, path19);
      return void 0;
    }
    function replaceNode(key, path19, node) {
      const parent = path19[path19.length - 1];
      if (identity.isCollection(parent)) {
        parent.items[key] = node;
      } else if (identity.isPair(parent)) {
        if (key === "key")
          parent.key = node;
        else
          parent.value = node;
      } else if (identity.isDocument(parent)) {
        parent.contents = node;
      } else {
        const pt = identity.isAlias(parent) ? "alias" : "scalar";
        throw new Error(`Cannot replace node with ${pt} parent`);
      }
    }
    exports.visit = visit;
    exports.visitAsync = visitAsync;
  }
});

// node_modules/yaml/dist/doc/directives.js
var require_directives = __commonJS({
  "node_modules/yaml/dist/doc/directives.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    var escapeChars = {
      "!": "%21",
      ",": "%2C",
      "[": "%5B",
      "]": "%5D",
      "{": "%7B",
      "}": "%7D"
    };
    var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
    var Directives = class _Directives {
      constructor(yaml, tags) {
        this.docStart = null;
        this.docEnd = false;
        this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
        this.tags = Object.assign({}, _Directives.defaultTags, tags);
      }
      clone() {
        const copy = new _Directives(this.yaml, this.tags);
        copy.docStart = this.docStart;
        return copy;
      }
      /**
       * During parsing, get a Directives instance for the current document and
       * update the stream state according to the current version's spec.
       */
      atDocument() {
        const res = new _Directives(this.yaml, this.tags);
        switch (this.yaml.version) {
          case "1.1":
            this.atNextDocument = true;
            break;
          case "1.2":
            this.atNextDocument = false;
            this.yaml = {
              explicit: _Directives.defaultYaml.explicit,
              version: "1.2"
            };
            this.tags = Object.assign({}, _Directives.defaultTags);
            break;
        }
        return res;
      }
      /**
       * @param onError - May be called even if the action was successful
       * @returns `true` on success
       */
      add(line, onError) {
        if (this.atNextDocument) {
          this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
          this.tags = Object.assign({}, _Directives.defaultTags);
          this.atNextDocument = false;
        }
        const parts = line.trim().split(/[ \t]+/);
        const name = parts.shift();
        switch (name) {
          case "%TAG": {
            if (parts.length !== 2) {
              onError(0, "%TAG directive should contain exactly two parts");
              if (parts.length < 2)
                return false;
            }
            const [handle, prefix] = parts;
            this.tags[handle] = prefix;
            return true;
          }
          case "%YAML": {
            this.yaml.explicit = true;
            if (parts.length !== 1) {
              onError(0, "%YAML directive should contain exactly one part");
              return false;
            }
            const [version] = parts;
            if (version === "1.1" || version === "1.2") {
              this.yaml.version = version;
              return true;
            } else {
              const isValid2 = /^\d+\.\d+$/.test(version);
              onError(6, `Unsupported YAML version ${version}`, isValid2);
              return false;
            }
          }
          default:
            onError(0, `Unknown directive ${name}`, true);
            return false;
        }
      }
      /**
       * Resolves a tag, matching handles to those defined in %TAG directives.
       *
       * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
       *   `'!local'` tag, or `null` if unresolvable.
       */
      tagName(source, onError) {
        if (source === "!")
          return "!";
        if (source[0] !== "!") {
          onError(`Not a valid tag: ${source}`);
          return null;
        }
        if (source[1] === "<") {
          const verbatim = source.slice(2, -1);
          if (verbatim === "!" || verbatim === "!!") {
            onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
            return null;
          }
          if (source[source.length - 1] !== ">")
            onError("Verbatim tags must end with a >");
          return verbatim;
        }
        const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
        if (!suffix)
          onError(`The ${source} tag has no suffix`);
        const prefix = this.tags[handle];
        if (prefix) {
          try {
            return prefix + decodeURIComponent(suffix);
          } catch (error) {
            onError(String(error));
            return null;
          }
        }
        if (handle === "!")
          return source;
        onError(`Could not resolve tag: ${source}`);
        return null;
      }
      /**
       * Given a fully resolved tag, returns its printable string form,
       * taking into account current tag prefixes and defaults.
       */
      tagString(tag) {
        for (const [handle, prefix] of Object.entries(this.tags)) {
          if (tag.startsWith(prefix))
            return handle + escapeTagName(tag.substring(prefix.length));
        }
        return tag[0] === "!" ? tag : `!<${tag}>`;
      }
      toString(doc) {
        const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
        const tagEntries = Object.entries(this.tags);
        let tagNames;
        if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
          const tags = {};
          visit.visit(doc.contents, (_key, node) => {
            if (identity.isNode(node) && node.tag)
              tags[node.tag] = true;
          });
          tagNames = Object.keys(tags);
        } else
          tagNames = [];
        for (const [handle, prefix] of tagEntries) {
          if (handle === "!!" && prefix === "tag:yaml.org,2002:")
            continue;
          if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
            lines.push(`%TAG ${handle} ${prefix}`);
        }
        return lines.join("\n");
      }
    };
    Directives.defaultYaml = { explicit: false, version: "1.2" };
    Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
    exports.Directives = Directives;
  }
});

// node_modules/yaml/dist/doc/anchors.js
var require_anchors = __commonJS({
  "node_modules/yaml/dist/doc/anchors.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    function anchorIsValid(anchor) {
      if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
        const sa = JSON.stringify(anchor);
        const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
        throw new Error(msg);
      }
      return true;
    }
    function anchorNames(root) {
      const anchors = /* @__PURE__ */ new Set();
      visit.visit(root, {
        Value(_key, node) {
          if (node.anchor)
            anchors.add(node.anchor);
        }
      });
      return anchors;
    }
    function findNewAnchor(prefix, exclude) {
      for (let i = 1; true; ++i) {
        const name = `${prefix}${i}`;
        if (!exclude.has(name))
          return name;
      }
    }
    function createNodeAnchors(doc, prefix) {
      const aliasObjects = [];
      const sourceObjects = /* @__PURE__ */ new Map();
      let prevAnchors = null;
      return {
        onAnchor: (source) => {
          aliasObjects.push(source);
          prevAnchors ?? (prevAnchors = anchorNames(doc));
          const anchor = findNewAnchor(prefix, prevAnchors);
          prevAnchors.add(anchor);
          return anchor;
        },
        /**
         * With circular references, the source node is only resolved after all
         * of its child nodes are. This is why anchors are set only after all of
         * the nodes have been created.
         */
        setAnchors: () => {
          for (const source of aliasObjects) {
            const ref = sourceObjects.get(source);
            if (typeof ref === "object" && ref.anchor && (identity.isScalar(ref.node) || identity.isCollection(ref.node))) {
              ref.node.anchor = ref.anchor;
            } else {
              const error = new Error("Failed to resolve repeated object (this should not happen)");
              error.source = source;
              throw error;
            }
          }
        },
        sourceObjects
      };
    }
    exports.anchorIsValid = anchorIsValid;
    exports.anchorNames = anchorNames;
    exports.createNodeAnchors = createNodeAnchors;
    exports.findNewAnchor = findNewAnchor;
  }
});

// node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = __commonJS({
  "node_modules/yaml/dist/doc/applyReviver.js"(exports) {
    "use strict";
    function applyReviver(reviver, obj, key, val) {
      if (val && typeof val === "object") {
        if (Array.isArray(val)) {
          for (let i = 0, len = val.length; i < len; ++i) {
            const v0 = val[i];
            const v1 = applyReviver(reviver, val, String(i), v0);
            if (v1 === void 0)
              delete val[i];
            else if (v1 !== v0)
              val[i] = v1;
          }
        } else if (val instanceof Map) {
          for (const k of Array.from(val.keys())) {
            const v0 = val.get(k);
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              val.delete(k);
            else if (v1 !== v0)
              val.set(k, v1);
          }
        } else if (val instanceof Set) {
          for (const v0 of Array.from(val)) {
            const v1 = applyReviver(reviver, val, v0, v0);
            if (v1 === void 0)
              val.delete(v0);
            else if (v1 !== v0) {
              val.delete(v0);
              val.add(v1);
            }
          }
        } else {
          for (const [k, v0] of Object.entries(val)) {
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              delete val[k];
            else if (v1 !== v0)
              val[k] = v1;
          }
        }
      }
      return reviver.call(obj, key, val);
    }
    exports.applyReviver = applyReviver;
  }
});

// node_modules/yaml/dist/nodes/toJS.js
var require_toJS = __commonJS({
  "node_modules/yaml/dist/nodes/toJS.js"(exports) {
    "use strict";
    var identity = require_identity();
    function toJS(value, arg, ctx) {
      if (Array.isArray(value))
        return value.map((v, i) => toJS(v, String(i), ctx));
      if (value && typeof value.toJSON === "function") {
        if (!ctx || !identity.hasAnchor(value))
          return value.toJSON(arg, ctx);
        const data = { aliasCount: 0, count: 1, res: void 0 };
        ctx.anchors.set(value, data);
        ctx.onCreate = (res2) => {
          data.res = res2;
          delete ctx.onCreate;
        };
        const res = value.toJSON(arg, ctx);
        if (ctx.onCreate)
          ctx.onCreate(res);
        return res;
      }
      if (typeof value === "bigint" && !ctx?.keep)
        return Number(value);
      return value;
    }
    exports.toJS = toJS;
  }
});

// node_modules/yaml/dist/nodes/Node.js
var require_Node = __commonJS({
  "node_modules/yaml/dist/nodes/Node.js"(exports) {
    "use strict";
    var applyReviver = require_applyReviver();
    var identity = require_identity();
    var toJS = require_toJS();
    var NodeBase = class {
      constructor(type) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: type });
      }
      /** Create a copy of this node.  */
      clone() {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** A plain JavaScript representation of this node. */
      toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        if (!identity.isDocument(doc))
          throw new TypeError("A document argument is required");
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc,
          keep: true,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this, "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
    };
    exports.NodeBase = NodeBase;
  }
});

// node_modules/yaml/dist/nodes/Alias.js
var require_Alias = __commonJS({
  "node_modules/yaml/dist/nodes/Alias.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var visit = require_visit();
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var Alias = class extends Node.NodeBase {
      constructor(source) {
        super(identity.ALIAS);
        this.source = source;
        Object.defineProperty(this, "tag", {
          set() {
            throw new Error("Alias nodes cannot have tags");
          }
        });
      }
      /**
       * Resolve the value of this alias within `doc`, finding the last
       * instance of the `source` anchor before this node.
       */
      resolve(doc, ctx) {
        if (ctx?.maxAliasCount === 0)
          throw new ReferenceError("Alias resolution is disabled");
        let nodes;
        if (ctx?.aliasResolveCache) {
          nodes = ctx.aliasResolveCache;
        } else {
          nodes = [];
          visit.visit(doc, {
            Node: (_key, node) => {
              if (identity.isAlias(node) || identity.hasAnchor(node))
                nodes.push(node);
            }
          });
          if (ctx)
            ctx.aliasResolveCache = nodes;
        }
        let found = void 0;
        for (const node of nodes) {
          if (node === this)
            break;
          if (node.anchor === this.source)
            found = node;
        }
        return found;
      }
      toJSON(_arg, ctx) {
        if (!ctx)
          return { source: this.source };
        const { anchors: anchors2, doc, maxAliasCount } = ctx;
        const source = this.resolve(doc, ctx);
        if (!source) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new ReferenceError(msg);
        }
        let data = anchors2.get(source);
        if (!data) {
          toJS.toJS(source, null, ctx);
          data = anchors2.get(source);
        }
        if (data?.res === void 0) {
          const msg = "This should not happen: Alias anchor was not resolved?";
          throw new ReferenceError(msg);
        }
        if (maxAliasCount >= 0) {
          data.count += 1;
          if (data.aliasCount === 0)
            data.aliasCount = getAliasCount(doc, source, anchors2);
          if (data.count * data.aliasCount > maxAliasCount) {
            const msg = "Excessive alias count indicates a resource exhaustion attack";
            throw new ReferenceError(msg);
          }
        }
        return data.res;
      }
      toString(ctx, _onComment, _onChompKeep) {
        const src = `*${this.source}`;
        if (ctx) {
          anchors.anchorIsValid(this.source);
          if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
            const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
            throw new Error(msg);
          }
          if (ctx.implicitKey)
            return `${src} `;
        }
        return src;
      }
    };
    function getAliasCount(doc, node, anchors2) {
      if (identity.isAlias(node)) {
        const source = node.resolve(doc);
        const anchor = anchors2 && source && anchors2.get(source);
        return anchor ? anchor.count * anchor.aliasCount : 0;
      } else if (identity.isCollection(node)) {
        let count = 0;
        for (const item of node.items) {
          const c = getAliasCount(doc, item, anchors2);
          if (c > count)
            count = c;
        }
        return count;
      } else if (identity.isPair(node)) {
        const kc = getAliasCount(doc, node.key, anchors2);
        const vc = getAliasCount(doc, node.value, anchors2);
        return Math.max(kc, vc);
      }
      return 1;
    }
    exports.Alias = Alias;
  }
});

// node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = __commonJS({
  "node_modules/yaml/dist/nodes/Scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
    var Scalar = class extends Node.NodeBase {
      constructor(value) {
        super(identity.SCALAR);
        this.value = value;
      }
      toJSON(arg, ctx) {
        return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
      }
      toString() {
        return String(this.value);
      }
    };
    Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
    Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
    Scalar.PLAIN = "PLAIN";
    Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
    Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
    exports.Scalar = Scalar;
    exports.isScalarValue = isScalarValue;
  }
});

// node_modules/yaml/dist/doc/createNode.js
var require_createNode = __commonJS({
  "node_modules/yaml/dist/doc/createNode.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var defaultTagPrefix = "tag:yaml.org,2002:";
    function findTagObject(value, tagName, tags) {
      if (tagName) {
        const match = tags.filter((t) => t.tag === tagName);
        const tagObj = match.find((t) => !t.format) ?? match[0];
        if (!tagObj)
          throw new Error(`Tag ${tagName} not found`);
        return tagObj;
      }
      return tags.find((t) => t.identify?.(value) && !t.format);
    }
    function createNode(value, tagName, ctx) {
      if (identity.isDocument(value))
        value = value.contents;
      if (identity.isNode(value))
        return value;
      if (identity.isPair(value)) {
        const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
        map.items.push(value);
        return map;
      }
      if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
        value = value.valueOf();
      }
      const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
      let ref = void 0;
      if (aliasDuplicateObjects && value && typeof value === "object") {
        ref = sourceObjects.get(value);
        if (ref) {
          ref.anchor ?? (ref.anchor = onAnchor(value));
          return new Alias.Alias(ref.anchor);
        } else {
          ref = { anchor: null, node: null };
          sourceObjects.set(value, ref);
        }
      }
      if (tagName?.startsWith("!!"))
        tagName = defaultTagPrefix + tagName.slice(2);
      let tagObj = findTagObject(value, tagName, schema.tags);
      if (!tagObj) {
        if (value && typeof value.toJSON === "function") {
          value = value.toJSON();
        }
        if (!value || typeof value !== "object") {
          const node2 = new Scalar.Scalar(value);
          if (ref)
            ref.node = node2;
          return node2;
        }
        tagObj = value instanceof Map ? schema[identity.MAP] : Symbol.iterator in Object(value) ? schema[identity.SEQ] : schema[identity.MAP];
      }
      if (onTagObj) {
        onTagObj(tagObj);
        delete ctx.onTagObj;
      }
      const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar.Scalar(value);
      if (tagName)
        node.tag = tagName;
      else if (!tagObj.default)
        node.tag = tagObj.tag;
      if (ref)
        ref.node = node;
      return node;
    }
    exports.createNode = createNode;
  }
});

// node_modules/yaml/dist/nodes/Collection.js
var require_Collection = __commonJS({
  "node_modules/yaml/dist/nodes/Collection.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var identity = require_identity();
    var Node = require_Node();
    function collectionFromPath(schema, path19, value) {
      let v = value;
      for (let i = path19.length - 1; i >= 0; --i) {
        const k = path19[i];
        if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
          const a = [];
          a[k] = v;
          v = a;
        } else {
          v = /* @__PURE__ */ new Map([[k, v]]);
        }
      }
      return createNode.createNode(v, void 0, {
        aliasDuplicateObjects: false,
        keepUndefined: false,
        onAnchor: () => {
          throw new Error("This should not happen, please report a bug.");
        },
        schema,
        sourceObjects: /* @__PURE__ */ new Map()
      });
    }
    var isEmptyPath = (path19) => path19 == null || typeof path19 === "object" && !!path19[Symbol.iterator]().next().done;
    var Collection = class extends Node.NodeBase {
      constructor(type, schema) {
        super(type);
        Object.defineProperty(this, "schema", {
          value: schema,
          configurable: true,
          enumerable: false,
          writable: true
        });
      }
      /**
       * Create a copy of this collection.
       *
       * @param schema - If defined, overwrites the original's schema
       */
      clone(schema) {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (schema)
          copy.schema = schema;
        copy.items = copy.items.map((it) => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /**
       * Adds a value to the collection. For `!!map` and `!!omap` the value must
       * be a Pair instance or a `{ key, value }` object, which may not have a key
       * that already exists in the map.
       */
      addIn(path19, value) {
        if (isEmptyPath(path19))
          this.add(value);
        else {
          const [key, ...rest] = path19;
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.addIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
      /**
       * Removes a value from the collection.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path19) {
        const [key, ...rest] = path19;
        if (rest.length === 0)
          return this.delete(key);
        const node = this.get(key, true);
        if (identity.isCollection(node))
          return node.deleteIn(rest);
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path19, keepScalar) {
        const [key, ...rest] = path19;
        const node = this.get(key, true);
        if (rest.length === 0)
          return !keepScalar && identity.isScalar(node) ? node.value : node;
        else
          return identity.isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
      }
      hasAllNullValues(allowScalar) {
        return this.items.every((node) => {
          if (!identity.isPair(node))
            return false;
          const n = node.value;
          return n == null || allowScalar && identity.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
        });
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       */
      hasIn(path19) {
        const [key, ...rest] = path19;
        if (rest.length === 0)
          return this.has(key);
        const node = this.get(key, true);
        return identity.isCollection(node) ? node.hasIn(rest) : false;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path19, value) {
        const [key, ...rest] = path19;
        if (rest.length === 0) {
          this.set(key, value);
        } else {
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.setIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
    };
    exports.Collection = Collection;
    exports.collectionFromPath = collectionFromPath;
    exports.isEmptyPath = isEmptyPath;
  }
});

// node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyComment.js"(exports) {
    "use strict";
    var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
    function indentComment(comment, indent) {
      if (/^\n+$/.test(comment))
        return comment.substring(1);
      return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
    }
    var lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
    exports.indentComment = indentComment;
    exports.lineComment = lineComment;
    exports.stringifyComment = stringifyComment;
  }
});

// node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = __commonJS({
  "node_modules/yaml/dist/stringify/foldFlowLines.js"(exports) {
    "use strict";
    var FOLD_FLOW = "flow";
    var FOLD_BLOCK = "block";
    var FOLD_QUOTED = "quoted";
    function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
      if (!lineWidth || lineWidth < 0)
        return text;
      if (lineWidth < minContentWidth)
        minContentWidth = 0;
      const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
      if (text.length <= endStep)
        return text;
      const folds = [];
      const escapedFolds = {};
      let end = lineWidth - indent.length;
      if (typeof indentAtStart === "number") {
        if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
          folds.push(0);
        else
          end = lineWidth - indentAtStart;
      }
      let split = void 0;
      let prev = void 0;
      let overflow = false;
      let i = -1;
      let escStart = -1;
      let escEnd = -1;
      if (mode === FOLD_BLOCK) {
        i = consumeMoreIndentedLines(text, i, indent.length);
        if (i !== -1)
          end = i + endStep;
      }
      for (let ch; ch = text[i += 1]; ) {
        if (mode === FOLD_QUOTED && ch === "\\") {
          escStart = i;
          switch (text[i + 1]) {
            case "x":
              i += 3;
              break;
            case "u":
              i += 5;
              break;
            case "U":
              i += 9;
              break;
            default:
              i += 1;
          }
          escEnd = i;
        }
        if (ch === "\n") {
          if (mode === FOLD_BLOCK)
            i = consumeMoreIndentedLines(text, i, indent.length);
          end = i + indent.length + endStep;
          split = void 0;
        } else {
          if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
            const next = text[i + 1];
            if (next && next !== " " && next !== "\n" && next !== "	")
              split = i;
          }
          if (i >= end) {
            if (split) {
              folds.push(split);
              end = split + endStep;
              split = void 0;
            } else if (mode === FOLD_QUOTED) {
              while (prev === " " || prev === "	") {
                prev = ch;
                ch = text[i += 1];
                overflow = true;
              }
              const j = i > escEnd + 1 ? i - 2 : escStart - 1;
              if (escapedFolds[j])
                return text;
              folds.push(j);
              escapedFolds[j] = true;
              end = j + endStep;
              split = void 0;
            } else {
              overflow = true;
            }
          }
        }
        prev = ch;
      }
      if (overflow && onOverflow)
        onOverflow();
      if (folds.length === 0)
        return text;
      if (onFold)
        onFold();
      let res = text.slice(0, folds[0]);
      for (let i2 = 0; i2 < folds.length; ++i2) {
        const fold = folds[i2];
        const end2 = folds[i2 + 1] || text.length;
        if (fold === 0)
          res = `
${indent}${text.slice(0, end2)}`;
        else {
          if (mode === FOLD_QUOTED && escapedFolds[fold])
            res += `${text[fold]}\\`;
          res += `
${indent}${text.slice(fold + 1, end2)}`;
        }
      }
      return res;
    }
    function consumeMoreIndentedLines(text, i, indent) {
      let end = i;
      let start = i + 1;
      let ch = text[start];
      while (ch === " " || ch === "	") {
        if (i < start + indent) {
          ch = text[++i];
        } else {
          do {
            ch = text[++i];
          } while (ch && ch !== "\n");
          end = i;
          start = i + 1;
          ch = text[start];
        }
      }
      return end;
    }
    exports.FOLD_BLOCK = FOLD_BLOCK;
    exports.FOLD_FLOW = FOLD_FLOW;
    exports.FOLD_QUOTED = FOLD_QUOTED;
    exports.foldFlowLines = foldFlowLines;
  }
});

// node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyString.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var foldFlowLines = require_foldFlowLines();
    var getFoldOptions = (ctx, isBlock) => ({
      indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
      lineWidth: ctx.options.lineWidth,
      minContentWidth: ctx.options.minContentWidth
    });
    var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
    function lineLengthOverLimit(str, lineWidth, indentLength) {
      if (!lineWidth || lineWidth < 0)
        return false;
      const limit = lineWidth - indentLength;
      const strLen = str.length;
      if (strLen <= limit)
        return false;
      for (let i = 0, start = 0; i < strLen; ++i) {
        if (str[i] === "\n") {
          if (i - start > limit)
            return true;
          start = i + 1;
          if (strLen - start <= limit)
            return false;
        }
      }
      return true;
    }
    function doubleQuotedString(value, ctx) {
      const json = JSON.stringify(value);
      if (ctx.options.doubleQuotedAsJSON)
        return json;
      const { implicitKey } = ctx;
      const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      let str = "";
      let start = 0;
      for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
        if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
          str += json.slice(start, i) + "\\ ";
          i += 1;
          start = i;
          ch = "\\";
        }
        if (ch === "\\")
          switch (json[i + 1]) {
            case "u":
              {
                str += json.slice(start, i);
                const code = json.substr(i + 2, 4);
                switch (code) {
                  case "0000":
                    str += "\\0";
                    break;
                  case "0007":
                    str += "\\a";
                    break;
                  case "000b":
                    str += "\\v";
                    break;
                  case "001b":
                    str += "\\e";
                    break;
                  case "0085":
                    str += "\\N";
                    break;
                  case "00a0":
                    str += "\\_";
                    break;
                  case "2028":
                    str += "\\L";
                    break;
                  case "2029":
                    str += "\\P";
                    break;
                  default:
                    if (code.substr(0, 2) === "00")
                      str += "\\x" + code.substr(2);
                    else
                      str += json.substr(i, 6);
                }
                i += 5;
                start = i + 1;
              }
              break;
            case "n":
              if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
                i += 1;
              } else {
                str += json.slice(start, i) + "\n\n";
                while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
                  str += "\n";
                  i += 2;
                }
                str += indent;
                if (json[i + 2] === " ")
                  str += "\\";
                i += 1;
                start = i + 1;
              }
              break;
            default:
              i += 1;
          }
      }
      str = start ? str + json.slice(start) : json;
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
    }
    function singleQuotedString(value, ctx) {
      if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
        return doubleQuotedString(value, ctx);
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
      return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function quotedString(value, ctx) {
      const { singleQuote } = ctx.options;
      let qs;
      if (singleQuote === false)
        qs = doubleQuotedString;
      else {
        const hasDouble = value.includes('"');
        const hasSingle = value.includes("'");
        if (hasDouble && !hasSingle)
          qs = singleQuotedString;
        else if (hasSingle && !hasDouble)
          qs = doubleQuotedString;
        else
          qs = singleQuote ? singleQuotedString : doubleQuotedString;
      }
      return qs(value, ctx);
    }
    var blockEndNewlines;
    try {
      blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
    } catch {
      blockEndNewlines = /\n+(?!\n|$)/g;
    }
    function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
      const { blockQuote, commentString, lineWidth } = ctx.options;
      if (!blockQuote || /\n[\t ]+$/.test(value)) {
        return quotedString(value, ctx);
      }
      const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
      const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
      if (!value)
        return literal ? "|\n" : ">\n";
      let chomp;
      let endStart;
      for (endStart = value.length; endStart > 0; --endStart) {
        const ch = value[endStart - 1];
        if (ch !== "\n" && ch !== "	" && ch !== " ")
          break;
      }
      let end = value.substring(endStart);
      const endNlPos = end.indexOf("\n");
      if (endNlPos === -1) {
        chomp = "-";
      } else if (value === end || endNlPos !== end.length - 1) {
        chomp = "+";
        if (onChompKeep)
          onChompKeep();
      } else {
        chomp = "";
      }
      if (end) {
        value = value.slice(0, -end.length);
        if (end[end.length - 1] === "\n")
          end = end.slice(0, -1);
        end = end.replace(blockEndNewlines, `$&${indent}`);
      }
      let startWithSpace = false;
      let startEnd;
      let startNlPos = -1;
      for (startEnd = 0; startEnd < value.length; ++startEnd) {
        const ch = value[startEnd];
        if (ch === " ")
          startWithSpace = true;
        else if (ch === "\n")
          startNlPos = startEnd;
        else
          break;
      }
      let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
      if (start) {
        value = value.substring(start.length);
        start = start.replace(/\n+/g, `$&${indent}`);
      }
      const indentSize = indent ? "2" : "1";
      let header = (startWithSpace ? indentSize : "") + chomp;
      if (comment) {
        header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
        if (onComment)
          onComment();
      }
      if (!literal) {
        const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
        let literalFallback = false;
        const foldOptions = getFoldOptions(ctx, true);
        if (blockQuote !== "folded" && type !== Scalar.Scalar.BLOCK_FOLDED) {
          foldOptions.onOverflow = () => {
            literalFallback = true;
          };
        }
        const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
        if (!literalFallback)
          return `>${header}
${indent}${body}`;
      }
      value = value.replace(/\n+/g, `$&${indent}`);
      return `|${header}
${indent}${start}${value}${end}`;
    }
    function plainString(item, ctx, onComment, onChompKeep) {
      const { type, value } = item;
      const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
      if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
        return quotedString(value, ctx);
      }
      if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
        return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
      }
      if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value.includes("\n")) {
        return blockString(item, ctx, onComment, onChompKeep);
      }
      if (containsDocumentMarker(value)) {
        if (indent === "") {
          ctx.forceBlockIndent = true;
          return blockString(item, ctx, onComment, onChompKeep);
        } else if (implicitKey && indent === indentStep) {
          return quotedString(value, ctx);
        }
      }
      const str = value.replace(/\n+/g, `$&
${indent}`);
      if (actualString) {
        const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
        const { compat, tags } = ctx.doc.schema;
        if (tags.some(test) || compat?.some(test))
          return quotedString(value, ctx);
      }
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function stringifyString(item, ctx, onComment, onChompKeep) {
      const { implicitKey, inFlow } = ctx;
      const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
      let { type } = item;
      if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
          type = Scalar.Scalar.QUOTE_DOUBLE;
      }
      const _stringify = (_type) => {
        switch (_type) {
          case Scalar.Scalar.BLOCK_FOLDED:
          case Scalar.Scalar.BLOCK_LITERAL:
            return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
          case Scalar.Scalar.QUOTE_DOUBLE:
            return doubleQuotedString(ss.value, ctx);
          case Scalar.Scalar.QUOTE_SINGLE:
            return singleQuotedString(ss.value, ctx);
          case Scalar.Scalar.PLAIN:
            return plainString(ss, ctx, onComment, onChompKeep);
          default:
            return null;
        }
      };
      let res = _stringify(type);
      if (res === null) {
        const { defaultKeyType, defaultStringType } = ctx.options;
        const t = implicitKey && defaultKeyType || defaultStringType;
        res = _stringify(t);
        if (res === null)
          throw new Error(`Unsupported default string type ${t}`);
      }
      return res;
    }
    exports.stringifyString = stringifyString;
  }
});

// node_modules/yaml/dist/stringify/stringify.js
var require_stringify = __commonJS({
  "node_modules/yaml/dist/stringify/stringify.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var identity = require_identity();
    var stringifyComment = require_stringifyComment();
    var stringifyString = require_stringifyString();
    function createStringifyContext(doc, options) {
      const opt = Object.assign({
        blockQuote: true,
        commentString: stringifyComment.stringifyComment,
        defaultKeyType: null,
        defaultStringType: "PLAIN",
        directives: null,
        doubleQuotedAsJSON: false,
        doubleQuotedMinMultiLineLength: 40,
        falseStr: "false",
        flowCollectionPadding: true,
        indentSeq: true,
        lineWidth: 80,
        minContentWidth: 20,
        nullStr: "null",
        simpleKeys: false,
        singleQuote: null,
        trailingComma: false,
        trueStr: "true",
        verifyAliasOrder: true
      }, doc.schema.toStringOptions, options);
      let inFlow;
      switch (opt.collectionStyle) {
        case "block":
          inFlow = false;
          break;
        case "flow":
          inFlow = true;
          break;
        default:
          inFlow = null;
      }
      return {
        anchors: /* @__PURE__ */ new Set(),
        doc,
        flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
        indent: "",
        indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
        inFlow,
        options: opt
      };
    }
    function getTagObject(tags, item) {
      if (item.tag) {
        const match = tags.filter((t) => t.tag === item.tag);
        if (match.length > 0)
          return match.find((t) => t.format === item.format) ?? match[0];
      }
      let tagObj = void 0;
      let obj;
      if (identity.isScalar(item)) {
        obj = item.value;
        let match = tags.filter((t) => t.identify?.(obj));
        if (match.length > 1) {
          const testMatch = match.filter((t) => t.test);
          if (testMatch.length > 0)
            match = testMatch;
        }
        tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
      } else {
        obj = item;
        tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
      }
      if (!tagObj) {
        const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
        throw new Error(`Tag not resolved for ${name} value`);
      }
      return tagObj;
    }
    function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
      if (!doc.directives)
        return "";
      const props = [];
      const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
      if (anchor && anchors.anchorIsValid(anchor)) {
        anchors$1.add(anchor);
        props.push(`&${anchor}`);
      }
      const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
      if (tag)
        props.push(doc.directives.tagString(tag));
      return props.join(" ");
    }
    function stringify(item, ctx, onComment, onChompKeep) {
      if (identity.isPair(item))
        return item.toString(ctx, onComment, onChompKeep);
      if (identity.isAlias(item)) {
        if (ctx.doc.directives)
          return item.toString(ctx);
        if (ctx.resolvedAliases?.has(item)) {
          throw new TypeError(`Cannot stringify circular structure without alias nodes`);
        } else {
          if (ctx.resolvedAliases)
            ctx.resolvedAliases.add(item);
          else
            ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
          item = item.resolve(ctx.doc);
        }
      }
      let tagObj = void 0;
      const node = identity.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
      tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
      const props = stringifyProps(node, tagObj, ctx);
      if (props.length > 0)
        ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
      const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
      if (!props)
        return str;
      return identity.isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
    }
    exports.createStringifyContext = createStringifyContext;
    exports.stringify = stringify;
  }
});

// node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyPair.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
      const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
      let keyComment = identity.isNode(key) && key.comment || null;
      if (simpleKeys) {
        if (keyComment) {
          throw new Error("With simple keys, key nodes cannot have comments");
        }
        if (identity.isCollection(key) || !identity.isNode(key) && typeof key === "object") {
          const msg = "With simple keys, collection cannot be used as a key value";
          throw new Error(msg);
        }
      }
      let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity.isCollection(key) || (identity.isScalar(key) ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL : typeof key === "object"));
      ctx = Object.assign({}, ctx, {
        allNullValues: false,
        implicitKey: !explicitKey && (simpleKeys || !allNullValues),
        indent: indent + indentStep
      });
      let keyCommentDone = false;
      let chompKeep = false;
      let str = stringify.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
      if (!explicitKey && !ctx.inFlow && str.length > 1024) {
        if (simpleKeys)
          throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
        explicitKey = true;
      }
      if (ctx.inFlow) {
        if (allNullValues || value == null) {
          if (keyCommentDone && onComment)
            onComment();
          return str === "" ? "?" : explicitKey ? `? ${str}` : str;
        }
      } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
        str = `? ${str}`;
        if (keyComment && !keyCommentDone) {
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        } else if (chompKeep && onChompKeep)
          onChompKeep();
        return str;
      }
      if (keyCommentDone)
        keyComment = null;
      if (explicitKey) {
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        str = `? ${str}
${indent}:`;
      } else {
        str = `${str}:`;
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
      }
      let vsb, vcb, valueComment;
      if (identity.isNode(value)) {
        vsb = !!value.spaceBefore;
        vcb = value.commentBefore;
        valueComment = value.comment;
      } else {
        vsb = false;
        vcb = null;
        valueComment = null;
        if (value && typeof value === "object")
          value = doc.createNode(value);
      }
      ctx.implicitKey = false;
      if (!explicitKey && !keyComment && identity.isScalar(value))
        ctx.indentAtStart = str.length + 1;
      chompKeep = false;
      if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity.isSeq(value) && !value.flow && !value.tag && !value.anchor) {
        ctx.indent = ctx.indent.substring(2);
      }
      let valueCommentDone = false;
      const valueStr = stringify.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
      let ws = " ";
      if (keyComment || vsb || vcb) {
        ws = vsb ? "\n" : "";
        if (vcb) {
          const cs = commentString(vcb);
          ws += `
${stringifyComment.indentComment(cs, ctx.indent)}`;
        }
        if (valueStr === "" && !ctx.inFlow) {
          if (ws === "\n" && valueComment)
            ws = "\n\n";
        } else {
          ws += `
${ctx.indent}`;
        }
      } else if (!explicitKey && identity.isCollection(value)) {
        const vs0 = valueStr[0];
        const nl0 = valueStr.indexOf("\n");
        const hasNewline = nl0 !== -1;
        const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
        if (hasNewline || !flow) {
          let hasPropsLine = false;
          if (hasNewline && (vs0 === "&" || vs0 === "!")) {
            let sp0 = valueStr.indexOf(" ");
            if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
              sp0 = valueStr.indexOf(" ", sp0 + 1);
            }
            if (sp0 === -1 || nl0 < sp0)
              hasPropsLine = true;
          }
          if (!hasPropsLine)
            ws = `
${ctx.indent}`;
        }
      } else if (valueStr === "" || valueStr[0] === "\n") {
        ws = "";
      }
      str += ws + valueStr;
      if (ctx.inFlow) {
        if (valueCommentDone && onComment)
          onComment();
      } else if (valueComment && !valueCommentDone) {
        str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
      } else if (chompKeep && onChompKeep) {
        onChompKeep();
      }
      return str;
    }
    exports.stringifyPair = stringifyPair;
  }
});

// node_modules/yaml/dist/log.js
var require_log = __commonJS({
  "node_modules/yaml/dist/log.js"(exports) {
    "use strict";
    var node_process = __require("process");
    function debug(logLevel, ...messages) {
      if (logLevel === "debug")
        console.log(...messages);
    }
    function warn2(logLevel, warning) {
      if (logLevel === "debug" || logLevel === "warn") {
        if (typeof node_process.emitWarning === "function")
          node_process.emitWarning(warning);
        else
          console.warn(warning);
      }
    }
    exports.debug = debug;
    exports.warn = warn2;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/merge.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var MERGE_KEY = "<<";
    var merge = {
      identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
      default: "key",
      tag: "tag:yaml.org,2002:merge",
      test: /^<<$/,
      resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
        addToJSMap: addMergeToJSMap
      }),
      stringify: () => MERGE_KEY
    };
    var isMergeKey = (ctx, key) => (merge.identify(key) || identity.isScalar(key) && (!key.type || key.type === Scalar.Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
    function addMergeToJSMap(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (identity.isSeq(source))
        for (const it of source.items)
          mergeValue(ctx, map, it);
      else if (Array.isArray(source))
        for (const it of source)
          mergeValue(ctx, map, it);
      else
        mergeValue(ctx, map, source);
    }
    function mergeValue(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (!identity.isMap(source))
        throw new Error("Merge sources must be maps or map aliases");
      const srcMap = source.toJSON(null, ctx, Map);
      for (const [key, value2] of srcMap) {
        if (map instanceof Map) {
          if (!map.has(key))
            map.set(key, value2);
        } else if (map instanceof Set) {
          map.add(key);
        } else if (!Object.prototype.hasOwnProperty.call(map, key)) {
          Object.defineProperty(map, key, {
            value: value2,
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      }
      return map;
    }
    function resolveAliasValue(ctx, value) {
      return ctx && identity.isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
    }
    exports.addMergeToJSMap = addMergeToJSMap;
    exports.isMergeKey = isMergeKey;
    exports.merge = merge;
  }
});

// node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = __commonJS({
  "node_modules/yaml/dist/nodes/addPairToJSMap.js"(exports) {
    "use strict";
    var log = require_log();
    var merge = require_merge();
    var stringify = require_stringify();
    var identity = require_identity();
    var toJS = require_toJS();
    function addPairToJSMap(ctx, map, { key, value }) {
      if (identity.isNode(key) && key.addToJSMap)
        key.addToJSMap(ctx, map, value);
      else if (merge.isMergeKey(ctx, key))
        merge.addMergeToJSMap(ctx, map, value);
      else {
        const jsKey = toJS.toJS(key, "", ctx);
        if (map instanceof Map) {
          map.set(jsKey, toJS.toJS(value, jsKey, ctx));
        } else if (map instanceof Set) {
          map.add(jsKey);
        } else {
          const stringKey = stringifyKey(key, jsKey, ctx);
          const jsValue = toJS.toJS(value, stringKey, ctx);
          if (stringKey in map)
            Object.defineProperty(map, stringKey, {
              value: jsValue,
              writable: true,
              enumerable: true,
              configurable: true
            });
          else
            map[stringKey] = jsValue;
        }
      }
      return map;
    }
    function stringifyKey(key, jsKey, ctx) {
      if (jsKey === null)
        return "";
      if (typeof jsKey !== "object")
        return String(jsKey);
      if (identity.isNode(key) && ctx?.doc) {
        const strCtx = stringify.createStringifyContext(ctx.doc, {});
        strCtx.anchors = /* @__PURE__ */ new Set();
        for (const node of ctx.anchors.keys())
          strCtx.anchors.add(node.anchor);
        strCtx.inFlow = true;
        strCtx.inStringifyKey = true;
        const strKey = key.toString(strCtx);
        if (!ctx.mapKeyWarned) {
          let jsonStr = JSON.stringify(strKey);
          if (jsonStr.length > 40)
            jsonStr = jsonStr.substring(0, 36) + '..."';
          log.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
          ctx.mapKeyWarned = true;
        }
        return strKey;
      }
      return JSON.stringify(jsKey);
    }
    exports.addPairToJSMap = addPairToJSMap;
  }
});

// node_modules/yaml/dist/nodes/Pair.js
var require_Pair = __commonJS({
  "node_modules/yaml/dist/nodes/Pair.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyPair = require_stringifyPair();
    var addPairToJSMap = require_addPairToJSMap();
    var identity = require_identity();
    function createPair(key, value, ctx) {
      const k = createNode.createNode(key, void 0, ctx);
      const v = createNode.createNode(value, void 0, ctx);
      return new Pair(k, v);
    }
    var Pair = class _Pair {
      constructor(key, value = null) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
        this.key = key;
        this.value = value;
      }
      clone(schema) {
        let { key, value } = this;
        if (identity.isNode(key))
          key = key.clone(schema);
        if (identity.isNode(value))
          value = value.clone(schema);
        return new _Pair(key, value);
      }
      toJSON(_, ctx) {
        const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        return addPairToJSMap.addPairToJSMap(ctx, pair, this);
      }
      toString(ctx, onComment, onChompKeep) {
        return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
      }
    };
    exports.Pair = Pair;
    exports.createPair = createPair;
  }
});

// node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyCollection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyCollection(collection, ctx, options) {
      const flow = ctx.inFlow ?? collection.flow;
      const stringify2 = flow ? stringifyFlowCollection : stringifyBlockCollection;
      return stringify2(collection, ctx, options);
    }
    function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
      const { indent, options: { commentString } } = ctx;
      const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
      let chompKeep = false;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment2 = null;
        if (identity.isNode(item)) {
          if (!chompKeep && item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
          if (item.comment)
            comment2 = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (!chompKeep && ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
          }
        }
        chompKeep = false;
        let str2 = stringify.stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
        if (comment2)
          str2 += stringifyComment.lineComment(str2, itemIndent, commentString(comment2));
        if (chompKeep && comment2)
          chompKeep = false;
        lines.push(blockItemPrefix + str2);
      }
      let str;
      if (lines.length === 0) {
        str = flowChars.start + flowChars.end;
      } else {
        str = lines[0];
        for (let i = 1; i < lines.length; ++i) {
          const line = lines[i];
          str += line ? `
${indent}${line}` : "\n";
        }
      }
      if (comment) {
        str += "\n" + stringifyComment.indentComment(commentString(comment), indent);
        if (onComment)
          onComment();
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str;
    }
    function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
      const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
      itemIndent += indentStep;
      const itemCtx = Object.assign({}, ctx, {
        indent: itemIndent,
        inFlow: true,
        type: null
      });
      let reqNewline = false;
      let linesAtValue = 0;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment = null;
        if (identity.isNode(item)) {
          if (item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, false);
          if (item.comment)
            comment = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, false);
            if (ik.comment)
              reqNewline = true;
          }
          const iv = identity.isNode(item.value) ? item.value : null;
          if (iv) {
            if (iv.comment)
              comment = iv.comment;
            if (iv.commentBefore)
              reqNewline = true;
          } else if (item.value == null && ik?.comment) {
            comment = ik.comment;
          }
        }
        if (comment)
          reqNewline = true;
        let str = stringify.stringify(item, itemCtx, () => comment = null);
        reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
        if (i < items.length - 1) {
          str += ",";
        } else if (ctx.options.trailingComma) {
          if (ctx.options.lineWidth > 0) {
            reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
          }
          if (reqNewline) {
            str += ",";
          }
        }
        if (comment)
          str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
        lines.push(str);
        linesAtValue = lines.length;
      }
      const { start, end } = flowChars;
      if (lines.length === 0) {
        return start + end;
      } else {
        if (!reqNewline) {
          const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
          reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
        }
        if (reqNewline) {
          let str = start;
          for (const line of lines)
            str += line ? `
${indentStep}${indent}${line}` : "\n";
          return `${str}
${indent}${end}`;
        } else {
          return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
        }
      }
    }
    function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
      if (comment && chompKeep)
        comment = comment.replace(/^\n+/, "");
      if (comment) {
        const ic = stringifyComment.indentComment(commentString(comment), indent);
        lines.push(ic.trimStart());
      }
    }
    exports.stringifyCollection = stringifyCollection;
  }
});

// node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = __commonJS({
  "node_modules/yaml/dist/nodes/YAMLMap.js"(exports) {
    "use strict";
    var stringifyCollection = require_stringifyCollection();
    var addPairToJSMap = require_addPairToJSMap();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    function findPair(items, key) {
      const k = identity.isScalar(key) ? key.value : key;
      for (const it of items) {
        if (identity.isPair(it)) {
          if (it.key === key || it.key === k)
            return it;
          if (identity.isScalar(it.key) && it.key.value === k)
            return it;
        }
      }
      return void 0;
    }
    var YAMLMap = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:map";
      }
      constructor(schema) {
        super(identity.MAP, schema);
        this.items = [];
      }
      /**
       * A generic collection parsing method that can be extended
       * to other node classes that inherit from YAMLMap
       */
      static from(schema, obj, ctx) {
        const { keepUndefined, replacer } = ctx;
        const map = new this(schema);
        const add = (key, value) => {
          if (typeof replacer === "function")
            value = replacer.call(obj, key, value);
          else if (Array.isArray(replacer) && !replacer.includes(key))
            return;
          if (value !== void 0 || keepUndefined)
            map.items.push(Pair.createPair(key, value, ctx));
        };
        if (obj instanceof Map) {
          for (const [key, value] of obj)
            add(key, value);
        } else if (obj && typeof obj === "object") {
          for (const key of Object.keys(obj))
            add(key, obj[key]);
        }
        if (typeof schema.sortMapEntries === "function") {
          map.items.sort(schema.sortMapEntries);
        }
        return map;
      }
      /**
       * Adds a value to the collection.
       *
       * @param overwrite - If not set `true`, using a key that is already in the
       *   collection will throw. Otherwise, overwrites the previous value.
       */
      add(pair, overwrite) {
        let _pair;
        if (identity.isPair(pair))
          _pair = pair;
        else if (!pair || typeof pair !== "object" || !("key" in pair)) {
          _pair = new Pair.Pair(pair, pair?.value);
        } else
          _pair = new Pair.Pair(pair.key, pair.value);
        const prev = findPair(this.items, _pair.key);
        const sortEntries = this.schema?.sortMapEntries;
        if (prev) {
          if (!overwrite)
            throw new Error(`Key ${_pair.key} already set`);
          if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
            prev.value.value = _pair.value;
          else
            prev.value = _pair.value;
        } else if (sortEntries) {
          const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
          if (i === -1)
            this.items.push(_pair);
          else
            this.items.splice(i, 0, _pair);
        } else {
          this.items.push(_pair);
        }
      }
      delete(key) {
        const it = findPair(this.items, key);
        if (!it)
          return false;
        const del = this.items.splice(this.items.indexOf(it), 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const it = findPair(this.items, key);
        const node = it?.value;
        return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? void 0;
      }
      has(key) {
        return !!findPair(this.items, key);
      }
      set(key, value) {
        this.add(new Pair.Pair(key, value), true);
      }
      /**
       * @param ctx - Conversion context, originally set in Document#toJS()
       * @param {Class} Type - If set, forces the returned collection type
       * @returns Instance of Type, Map, or Object
       */
      toJSON(_, ctx, Type) {
        const map = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const item of this.items)
          addPairToJSMap.addPairToJSMap(ctx, map, item);
        return map;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        for (const item of this.items) {
          if (!identity.isPair(item))
            throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
        }
        if (!ctx.allNullValues && this.hasAllNullValues(false))
          ctx = Object.assign({}, ctx, { allNullValues: true });
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "",
          flowChars: { start: "{", end: "}" },
          itemIndent: ctx.indent || "",
          onChompKeep,
          onComment
        });
      }
    };
    exports.YAMLMap = YAMLMap;
    exports.findPair = findPair;
  }
});

// node_modules/yaml/dist/schema/common/map.js
var require_map = __commonJS({
  "node_modules/yaml/dist/schema/common/map.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLMap = require_YAMLMap();
    var map = {
      collection: "map",
      default: true,
      nodeClass: YAMLMap.YAMLMap,
      tag: "tag:yaml.org,2002:map",
      resolve(map2, onError) {
        if (!identity.isMap(map2))
          onError("Expected a mapping for this tag");
        return map2;
      },
      createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
    };
    exports.map = map;
  }
});

// node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = __commonJS({
  "node_modules/yaml/dist/nodes/YAMLSeq.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyCollection = require_stringifyCollection();
    var Collection = require_Collection();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var toJS = require_toJS();
    var YAMLSeq = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:seq";
      }
      constructor(schema) {
        super(identity.SEQ, schema);
        this.items = [];
      }
      add(value) {
        this.items.push(value);
      }
      /**
       * Removes a value from the collection.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       *
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return false;
        const del = this.items.splice(idx, 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return void 0;
        const it = this.items[idx];
        return !keepScalar && identity.isScalar(it) ? it.value : it;
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       */
      has(key) {
        const idx = asItemIndex(key);
        return typeof idx === "number" && idx < this.items.length;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       *
       * If `key` does not contain a representation of an integer, this will throw.
       * It may be wrapped in a `Scalar`.
       */
      set(key, value) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          throw new Error(`Expected a valid index, not ${key}.`);
        const prev = this.items[idx];
        if (identity.isScalar(prev) && Scalar.isScalarValue(value))
          prev.value = value;
        else
          this.items[idx] = value;
      }
      toJSON(_, ctx) {
        const seq = [];
        if (ctx?.onCreate)
          ctx.onCreate(seq);
        let i = 0;
        for (const item of this.items)
          seq.push(toJS.toJS(item, String(i++), ctx));
        return seq;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "- ",
          flowChars: { start: "[", end: "]" },
          itemIndent: (ctx.indent || "") + "  ",
          onChompKeep,
          onComment
        });
      }
      static from(schema, obj, ctx) {
        const { replacer } = ctx;
        const seq = new this(schema);
        if (obj && Symbol.iterator in Object(obj)) {
          let i = 0;
          for (let it of obj) {
            if (typeof replacer === "function") {
              const key = obj instanceof Set ? it : String(i++);
              it = replacer.call(obj, key, it);
            }
            seq.items.push(createNode.createNode(it, void 0, ctx));
          }
        }
        return seq;
      }
    };
    function asItemIndex(key) {
      let idx = identity.isScalar(key) ? key.value : key;
      if (idx && typeof idx === "string")
        idx = Number(idx);
      return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
    }
    exports.YAMLSeq = YAMLSeq;
  }
});

// node_modules/yaml/dist/schema/common/seq.js
var require_seq = __commonJS({
  "node_modules/yaml/dist/schema/common/seq.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLSeq = require_YAMLSeq();
    var seq = {
      collection: "seq",
      default: true,
      nodeClass: YAMLSeq.YAMLSeq,
      tag: "tag:yaml.org,2002:seq",
      resolve(seq2, onError) {
        if (!identity.isSeq(seq2))
          onError("Expected a sequence for this tag");
        return seq2;
      },
      createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
    };
    exports.seq = seq;
  }
});

// node_modules/yaml/dist/schema/common/string.js
var require_string = __commonJS({
  "node_modules/yaml/dist/schema/common/string.js"(exports) {
    "use strict";
    var stringifyString = require_stringifyString();
    var string = {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str) => str,
      stringify(item, ctx, onComment, onChompKeep) {
        ctx = Object.assign({ actualString: true }, ctx);
        return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
      }
    };
    exports.string = string;
  }
});

// node_modules/yaml/dist/schema/common/null.js
var require_null = __commonJS({
  "node_modules/yaml/dist/schema/common/null.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var nullTag = {
      identify: (value) => value == null,
      createNode: () => new Scalar.Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^(?:~|[Nn]ull|NULL)?$/,
      resolve: () => new Scalar.Scalar(null),
      stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
    };
    exports.nullTag = nullTag;
  }
});

// node_modules/yaml/dist/schema/core/bool.js
var require_bool = __commonJS({
  "node_modules/yaml/dist/schema/core/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var boolTag = {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
      resolve: (str) => new Scalar.Scalar(str[0] === "t" || str[0] === "T"),
      stringify({ source, value }, ctx) {
        if (source && boolTag.test.test(source)) {
          const sv = source[0] === "t" || source[0] === "T";
          if (value === sv)
            return source;
        }
        return value ? ctx.options.trueStr : ctx.options.falseStr;
      }
    };
    exports.boolTag = boolTag;
  }
});

// node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyNumber.js"(exports) {
    "use strict";
    function stringifyNumber({ format, minFractionDigits, tag, value }) {
      if (typeof value === "bigint")
        return String(value);
      const num = typeof value === "number" ? value : Number(value);
      if (!isFinite(num))
        return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
      let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
      if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
        let i = n.indexOf(".");
        if (i < 0) {
          i = n.length;
          n += ".";
        }
        let d = minFractionDigits - (n.length - i - 1);
        while (d-- > 0)
          n += "0";
      }
      return n;
    }
    exports.stringifyNumber = stringifyNumber;
  }
});

// node_modules/yaml/dist/schema/core/float.js
var require_float = __commonJS({
  "node_modules/yaml/dist/schema/core/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str));
        const dot = str.indexOf(".");
        if (dot !== -1 && str[str.length - 1] === "0")
          node.minFractionDigits = str.length - dot - 1;
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// node_modules/yaml/dist/schema/core/int.js
var require_int = __commonJS({
  "node_modules/yaml/dist/schema/core/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value) && value >= 0)
        return prefix + value.toString(radix);
      return stringifyNumber.stringifyNumber(node);
    }
    var intOct = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^0o[0-7]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
      stringify: (node) => intStringify(node, 8, "0o")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^0x[0-9a-fA-F]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/yaml/dist/schema/core/schema.js
var require_schema = __commonJS({
  "node_modules/yaml/dist/schema/core/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.boolTag,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float
    ];
    exports.schema = schema;
  }
});

// node_modules/yaml/dist/schema/json/schema.js
var require_schema2 = __commonJS({
  "node_modules/yaml/dist/schema/json/schema.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var map = require_map();
    var seq = require_seq();
    function intIdentify(value) {
      return typeof value === "bigint" || Number.isInteger(value);
    }
    var stringifyJSON = ({ value }) => JSON.stringify(value);
    var jsonScalars = [
      {
        identify: (value) => typeof value === "string",
        default: true,
        tag: "tag:yaml.org,2002:str",
        resolve: (str) => str,
        stringify: stringifyJSON
      },
      {
        identify: (value) => value == null,
        createNode: () => new Scalar.Scalar(null),
        default: true,
        tag: "tag:yaml.org,2002:null",
        test: /^null$/,
        resolve: () => null,
        stringify: stringifyJSON
      },
      {
        identify: (value) => typeof value === "boolean",
        default: true,
        tag: "tag:yaml.org,2002:bool",
        test: /^true$|^false$/,
        resolve: (str) => str === "true",
        stringify: stringifyJSON
      },
      {
        identify: intIdentify,
        default: true,
        tag: "tag:yaml.org,2002:int",
        test: /^-?(?:0|[1-9][0-9]*)$/,
        resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
        stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
      },
      {
        identify: (value) => typeof value === "number",
        default: true,
        tag: "tag:yaml.org,2002:float",
        test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
        resolve: (str) => parseFloat(str),
        stringify: stringifyJSON
      }
    ];
    var jsonError = {
      default: true,
      tag: "",
      test: /^/,
      resolve(str, onError) {
        onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
        return str;
      }
    };
    var schema = [map.map, seq.seq].concat(jsonScalars, jsonError);
    exports.schema = schema;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/binary.js"(exports) {
    "use strict";
    var node_buffer = __require("buffer");
    var Scalar = require_Scalar();
    var stringifyString = require_stringifyString();
    var binary = {
      identify: (value) => value instanceof Uint8Array,
      // Buffer inherits from Uint8Array
      default: false,
      tag: "tag:yaml.org,2002:binary",
      /**
       * Returns a Buffer in node and an Uint8Array in browsers
       *
       * To use the resulting buffer as an image, you'll want to do something like:
       *
       *   const blob = new Blob([buffer], { type: 'image/jpeg' })
       *   document.querySelector('#photo').src = URL.createObjectURL(blob)
       */
      resolve(src, onError) {
        if (typeof node_buffer.Buffer === "function") {
          return node_buffer.Buffer.from(src, "base64");
        } else if (typeof atob === "function") {
          const str = atob(src.replace(/[\n\r]/g, ""));
          const buffer = new Uint8Array(str.length);
          for (let i = 0; i < str.length; ++i)
            buffer[i] = str.charCodeAt(i);
          return buffer;
        } else {
          onError("This environment does not support reading binary tags; either Buffer or atob is required");
          return src;
        }
      },
      stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
        if (!value)
          return "";
        const buf = value;
        let str;
        if (typeof node_buffer.Buffer === "function") {
          str = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
        } else if (typeof btoa === "function") {
          let s = "";
          for (let i = 0; i < buf.length; ++i)
            s += String.fromCharCode(buf[i]);
          str = btoa(s);
        } else {
          throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
        }
        type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
        if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
          const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
          const n = Math.ceil(str.length / lineWidth);
          const lines = new Array(n);
          for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
            lines[i] = str.substr(o, lineWidth);
          }
          str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? "\n" : " ");
        }
        return stringifyString.stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
      }
    };
    exports.binary = binary;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/pairs.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLSeq = require_YAMLSeq();
    function resolvePairs(seq, onError) {
      if (identity.isSeq(seq)) {
        for (let i = 0; i < seq.items.length; ++i) {
          let item = seq.items[i];
          if (identity.isPair(item))
            continue;
          else if (identity.isMap(item)) {
            if (item.items.length > 1)
              onError("Each pair must have its own sequence indicator");
            const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
            if (item.commentBefore)
              pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
            if (item.comment) {
              const cn = pair.value ?? pair.key;
              cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
            }
            item = pair;
          }
          seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
        }
      } else
        onError("Expected a sequence for this tag");
      return seq;
    }
    function createPairs(schema, iterable, ctx) {
      const { replacer } = ctx;
      const pairs2 = new YAMLSeq.YAMLSeq(schema);
      pairs2.tag = "tag:yaml.org,2002:pairs";
      let i = 0;
      if (iterable && Symbol.iterator in Object(iterable))
        for (let it of iterable) {
          if (typeof replacer === "function")
            it = replacer.call(iterable, String(i++), it);
          let key, value;
          if (Array.isArray(it)) {
            if (it.length === 2) {
              key = it[0];
              value = it[1];
            } else
              throw new TypeError(`Expected [key, value] tuple: ${it}`);
          } else if (it && it instanceof Object) {
            const keys = Object.keys(it);
            if (keys.length === 1) {
              key = keys[0];
              value = it[key];
            } else {
              throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
            }
          } else {
            key = it;
          }
          pairs2.items.push(Pair.createPair(key, value, ctx));
        }
      return pairs2;
    }
    var pairs = {
      collection: "seq",
      default: false,
      tag: "tag:yaml.org,2002:pairs",
      resolve: resolvePairs,
      createNode: createPairs
    };
    exports.createPairs = createPairs;
    exports.pairs = pairs;
    exports.resolvePairs = resolvePairs;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/omap.js"(exports) {
    "use strict";
    var identity = require_identity();
    var toJS = require_toJS();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var pairs = require_pairs();
    var YAMLOMap = class _YAMLOMap extends YAMLSeq.YAMLSeq {
      constructor() {
        super();
        this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
        this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
        this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
        this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
        this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
        this.tag = _YAMLOMap.tag;
      }
      /**
       * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
       * but TypeScript won't allow widening the signature of a child method.
       */
      toJSON(_, ctx) {
        if (!ctx)
          return super.toJSON(_);
        const map = /* @__PURE__ */ new Map();
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const pair of this.items) {
          let key, value;
          if (identity.isPair(pair)) {
            key = toJS.toJS(pair.key, "", ctx);
            value = toJS.toJS(pair.value, key, ctx);
          } else {
            key = toJS.toJS(pair, "", ctx);
          }
          if (map.has(key))
            throw new Error("Ordered maps must not include duplicate keys");
          map.set(key, value);
        }
        return map;
      }
      static from(schema, iterable, ctx) {
        const pairs$1 = pairs.createPairs(schema, iterable, ctx);
        const omap2 = new this();
        omap2.items = pairs$1.items;
        return omap2;
      }
    };
    YAMLOMap.tag = "tag:yaml.org,2002:omap";
    var omap = {
      collection: "seq",
      identify: (value) => value instanceof Map,
      nodeClass: YAMLOMap,
      default: false,
      tag: "tag:yaml.org,2002:omap",
      resolve(seq, onError) {
        const pairs$1 = pairs.resolvePairs(seq, onError);
        const seenKeys = [];
        for (const { key } of pairs$1.items) {
          if (identity.isScalar(key)) {
            if (seenKeys.includes(key.value)) {
              onError(`Ordered maps must not include duplicate keys: ${key.value}`);
            } else {
              seenKeys.push(key.value);
            }
          }
        }
        return Object.assign(new YAMLOMap(), pairs$1);
      },
      createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
    };
    exports.YAMLOMap = YAMLOMap;
    exports.omap = omap;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function boolStringify({ value, source }, ctx) {
      const boolObj = value ? trueTag : falseTag;
      if (source && boolObj.test.test(source))
        return source;
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
    var trueTag = {
      identify: (value) => value === true,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
      resolve: () => new Scalar.Scalar(true),
      stringify: boolStringify
    };
    var falseTag = {
      identify: (value) => value === false,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
      resolve: () => new Scalar.Scalar(false),
      stringify: boolStringify
    };
    exports.falseTag = falseTag;
    exports.trueTag = trueTag;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str.replace(/_/g, "")),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str.replace(/_/g, "")));
        const dot = str.indexOf(".");
        if (dot !== -1) {
          const f = str.substring(dot + 1).replace(/_/g, "");
          if (f[f.length - 1] === "0")
            node.minFractionDigits = f.length;
        }
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    function intResolve(str, offset, radix, { intAsBigInt }) {
      const sign = str[0];
      if (sign === "-" || sign === "+")
        offset += 1;
      str = str.substring(offset).replace(/_/g, "");
      if (intAsBigInt) {
        switch (radix) {
          case 2:
            str = `0b${str}`;
            break;
          case 8:
            str = `0o${str}`;
            break;
          case 16:
            str = `0x${str}`;
            break;
        }
        const n2 = BigInt(str);
        return sign === "-" ? BigInt(-1) * n2 : n2;
      }
      const n = parseInt(str, radix);
      return sign === "-" ? -1 * n : n;
    }
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value)) {
        const str = value.toString(radix);
        return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
      }
      return stringifyNumber.stringifyNumber(node);
    }
    var intBin = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "BIN",
      test: /^[-+]?0b[0-1_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
      stringify: (node) => intStringify(node, 2, "0b")
    };
    var intOct = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^[-+]?0[0-7_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
      stringify: (node) => intStringify(node, 8, "0")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9][0-9_]*$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^[-+]?0x[0-9a-fA-F_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intBin = intBin;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/set.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSet = class _YAMLSet extends YAMLMap.YAMLMap {
      constructor(schema) {
        super(schema);
        this.tag = _YAMLSet.tag;
      }
      add(key) {
        let pair;
        if (identity.isPair(key))
          pair = key;
        else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
          pair = new Pair.Pair(key.key, null);
        else
          pair = new Pair.Pair(key, null);
        const prev = YAMLMap.findPair(this.items, pair.key);
        if (!prev)
          this.items.push(pair);
      }
      /**
       * If `keepPair` is `true`, returns the Pair matching `key`.
       * Otherwise, returns the value of that Pair's key.
       */
      get(key, keepPair) {
        const pair = YAMLMap.findPair(this.items, key);
        return !keepPair && identity.isPair(pair) ? identity.isScalar(pair.key) ? pair.key.value : pair.key : pair;
      }
      set(key, value) {
        if (typeof value !== "boolean")
          throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
        const prev = YAMLMap.findPair(this.items, key);
        if (prev && !value) {
          this.items.splice(this.items.indexOf(prev), 1);
        } else if (!prev && value) {
          this.items.push(new Pair.Pair(key));
        }
      }
      toJSON(_, ctx) {
        return super.toJSON(_, ctx, Set);
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        if (this.hasAllNullValues(true))
          return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
        else
          throw new Error("Set items must all have null values");
      }
      static from(schema, iterable, ctx) {
        const { replacer } = ctx;
        const set2 = new this(schema);
        if (iterable && Symbol.iterator in Object(iterable))
          for (let value of iterable) {
            if (typeof replacer === "function")
              value = replacer.call(iterable, value, value);
            set2.items.push(Pair.createPair(value, null, ctx));
          }
        return set2;
      }
    };
    YAMLSet.tag = "tag:yaml.org,2002:set";
    var set = {
      collection: "map",
      identify: (value) => value instanceof Set,
      nodeClass: YAMLSet,
      default: false,
      tag: "tag:yaml.org,2002:set",
      createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
      resolve(map, onError) {
        if (identity.isMap(map)) {
          if (map.hasAllNullValues(true))
            return Object.assign(new YAMLSet(), map);
          else
            onError("Set items must all have null values");
        } else
          onError("Expected a mapping for this tag");
        return map;
      }
    };
    exports.YAMLSet = YAMLSet;
    exports.set = set;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/timestamp.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    function parseSexagesimal(str, asBigInt) {
      const sign = str[0];
      const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
      const num = (n) => asBigInt ? BigInt(n) : Number(n);
      const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
      return sign === "-" ? num(-1) * res : res;
    }
    function stringifySexagesimal(node) {
      let { value } = node;
      let num = (n) => n;
      if (typeof value === "bigint")
        num = (n) => BigInt(n);
      else if (isNaN(value) || !isFinite(value))
        return stringifyNumber.stringifyNumber(node);
      let sign = "";
      if (value < 0) {
        sign = "-";
        value *= num(-1);
      }
      const _60 = num(60);
      const parts = [value % _60];
      if (value < 60) {
        parts.unshift(0);
      } else {
        value = (value - parts[0]) / _60;
        parts.unshift(value % _60);
        if (value >= 60) {
          value = (value - parts[0]) / _60;
          parts.unshift(value);
        }
      }
      return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
    }
    var intTime = {
      identify: (value) => typeof value === "bigint" || Number.isInteger(value),
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
      resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
      stringify: stringifySexagesimal
    };
    var floatTime = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
      resolve: (str) => parseSexagesimal(str, false),
      stringify: stringifySexagesimal
    };
    var timestamp = {
      identify: (value) => value instanceof Date,
      default: true,
      tag: "tag:yaml.org,2002:timestamp",
      // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
      // may be omitted altogether, resulting in a date format. In such a case, the time part is
      // assumed to be 00:00:00Z (start of day, UTC).
      test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
      resolve(str) {
        const match = str.match(timestamp.test);
        if (!match)
          throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
        const [, year, month, day, hour, minute, second] = match.map(Number);
        const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
        let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
        const tz = match[8];
        if (tz && tz !== "Z") {
          let d = parseSexagesimal(tz, false);
          if (Math.abs(d) < 30)
            d *= 60;
          date -= 6e4 * d;
        }
        return new Date(date);
      },
      stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
    };
    exports.floatTime = floatTime;
    exports.intTime = intTime;
    exports.timestamp = timestamp;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema3 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var binary = require_binary();
    var bool = require_bool2();
    var float = require_float2();
    var int = require_int2();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var set = require_set();
    var timestamp = require_timestamp();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.trueTag,
      bool.falseTag,
      int.intBin,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float,
      binary.binary,
      merge.merge,
      omap.omap,
      pairs.pairs,
      set.set,
      timestamp.intTime,
      timestamp.floatTime,
      timestamp.timestamp
    ];
    exports.schema = schema;
  }
});

// node_modules/yaml/dist/schema/tags.js
var require_tags = __commonJS({
  "node_modules/yaml/dist/schema/tags.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = require_schema();
    var schema$1 = require_schema2();
    var binary = require_binary();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var schema$2 = require_schema3();
    var set = require_set();
    var timestamp = require_timestamp();
    var schemas = /* @__PURE__ */ new Map([
      ["core", schema.schema],
      ["failsafe", [map.map, seq.seq, string.string]],
      ["json", schema$1.schema],
      ["yaml11", schema$2.schema],
      ["yaml-1.1", schema$2.schema]
    ]);
    var tagsByName = {
      binary: binary.binary,
      bool: bool.boolTag,
      float: float.float,
      floatExp: float.floatExp,
      floatNaN: float.floatNaN,
      floatTime: timestamp.floatTime,
      int: int.int,
      intHex: int.intHex,
      intOct: int.intOct,
      intTime: timestamp.intTime,
      map: map.map,
      merge: merge.merge,
      null: _null.nullTag,
      omap: omap.omap,
      pairs: pairs.pairs,
      seq: seq.seq,
      set: set.set,
      timestamp: timestamp.timestamp
    };
    var coreKnownTags = {
      "tag:yaml.org,2002:binary": binary.binary,
      "tag:yaml.org,2002:merge": merge.merge,
      "tag:yaml.org,2002:omap": omap.omap,
      "tag:yaml.org,2002:pairs": pairs.pairs,
      "tag:yaml.org,2002:set": set.set,
      "tag:yaml.org,2002:timestamp": timestamp.timestamp
    };
    function getTags(customTags, schemaName, addMergeTag) {
      const schemaTags = schemas.get(schemaName);
      if (schemaTags && !customTags) {
        return addMergeTag && !schemaTags.includes(merge.merge) ? schemaTags.concat(merge.merge) : schemaTags.slice();
      }
      let tags = schemaTags;
      if (!tags) {
        if (Array.isArray(customTags))
          tags = [];
        else {
          const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
        }
      }
      if (Array.isArray(customTags)) {
        for (const tag of customTags)
          tags = tags.concat(tag);
      } else if (typeof customTags === "function") {
        tags = customTags(tags.slice());
      }
      if (addMergeTag)
        tags = tags.concat(merge.merge);
      return tags.reduce((tags2, tag) => {
        const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
        if (!tagObj) {
          const tagName = JSON.stringify(tag);
          const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
        }
        if (!tags2.includes(tagObj))
          tags2.push(tagObj);
        return tags2;
      }, []);
    }
    exports.coreKnownTags = coreKnownTags;
    exports.getTags = getTags;
  }
});

// node_modules/yaml/dist/schema/Schema.js
var require_Schema = __commonJS({
  "node_modules/yaml/dist/schema/Schema.js"(exports) {
    "use strict";
    var identity = require_identity();
    var map = require_map();
    var seq = require_seq();
    var string = require_string();
    var tags = require_tags();
    var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    var Schema = class _Schema {
      constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
        this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
        this.name = typeof schema === "string" && schema || "core";
        this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
        this.tags = tags.getTags(customTags, this.name, merge);
        this.toStringOptions = toStringDefaults ?? null;
        Object.defineProperty(this, identity.MAP, { value: map.map });
        Object.defineProperty(this, identity.SCALAR, { value: string.string });
        Object.defineProperty(this, identity.SEQ, { value: seq.seq });
        this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
      }
      clone() {
        const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
        copy.tags = this.tags.slice();
        return copy;
      }
    };
    exports.Schema = Schema;
  }
});

// node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyDocument.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyDocument(doc, options) {
      const lines = [];
      let hasDirectives = options.directives === true;
      if (options.directives !== false && doc.directives) {
        const dir = doc.directives.toString(doc);
        if (dir) {
          lines.push(dir);
          hasDirectives = true;
        } else if (doc.directives.docStart)
          hasDirectives = true;
      }
      if (hasDirectives)
        lines.push("---");
      const ctx = stringify.createStringifyContext(doc, options);
      const { commentString } = ctx.options;
      if (doc.commentBefore) {
        if (lines.length !== 1)
          lines.unshift("");
        const cs = commentString(doc.commentBefore);
        lines.unshift(stringifyComment.indentComment(cs, ""));
      }
      let chompKeep = false;
      let contentComment = null;
      if (doc.contents) {
        if (identity.isNode(doc.contents)) {
          if (doc.contents.spaceBefore && hasDirectives)
            lines.push("");
          if (doc.contents.commentBefore) {
            const cs = commentString(doc.contents.commentBefore);
            lines.push(stringifyComment.indentComment(cs, ""));
          }
          ctx.forceBlockIndent = !!doc.comment;
          contentComment = doc.contents.comment;
        }
        const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
        let body = stringify.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
        if (contentComment)
          body += stringifyComment.lineComment(body, "", commentString(contentComment));
        if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
          lines[lines.length - 1] = `--- ${body}`;
        } else
          lines.push(body);
      } else {
        lines.push(stringify.stringify(doc.contents, ctx));
      }
      if (doc.directives?.docEnd) {
        if (doc.comment) {
          const cs = commentString(doc.comment);
          if (cs.includes("\n")) {
            lines.push("...");
            lines.push(stringifyComment.indentComment(cs, ""));
          } else {
            lines.push(`... ${cs}`);
          }
        } else {
          lines.push("...");
        }
      } else {
        let dc = doc.comment;
        if (dc && chompKeep)
          dc = dc.replace(/^\n+/, "");
        if (dc) {
          if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
            lines.push("");
          lines.push(stringifyComment.indentComment(commentString(dc), ""));
        }
      }
      return lines.join("\n") + "\n";
    }
    exports.stringifyDocument = stringifyDocument;
  }
});

// node_modules/yaml/dist/doc/Document.js
var require_Document = __commonJS({
  "node_modules/yaml/dist/doc/Document.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var toJS = require_toJS();
    var Schema = require_Schema();
    var stringifyDocument = require_stringifyDocument();
    var anchors = require_anchors();
    var applyReviver = require_applyReviver();
    var createNode = require_createNode();
    var directives = require_directives();
    var Document = class _Document {
      constructor(value, replacer, options) {
        this.commentBefore = null;
        this.comment = null;
        this.errors = [];
        this.warnings = [];
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
        let _replacer = null;
        if (typeof replacer === "function" || Array.isArray(replacer)) {
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const opt = Object.assign({
          intAsBigInt: false,
          keepSourceTokens: false,
          logLevel: "warn",
          prettyErrors: true,
          strict: true,
          stringKeys: false,
          uniqueKeys: true,
          version: "1.2"
        }, options);
        this.options = opt;
        let { version } = opt;
        if (options?._directives) {
          this.directives = options._directives.atDocument();
          if (this.directives.yaml.explicit)
            version = this.directives.yaml.version;
        } else
          this.directives = new directives.Directives({ version });
        this.setSchema(version, options);
        this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
      }
      /**
       * Create a deep copy of this Document and its contents.
       *
       * Custom Node values that inherit from `Object` still refer to their original instances.
       */
      clone() {
        const copy = Object.create(_Document.prototype, {
          [identity.NODE_TYPE]: { value: identity.DOC }
        });
        copy.commentBefore = this.commentBefore;
        copy.comment = this.comment;
        copy.errors = this.errors.slice();
        copy.warnings = this.warnings.slice();
        copy.options = Object.assign({}, this.options);
        if (this.directives)
          copy.directives = this.directives.clone();
        copy.schema = this.schema.clone();
        copy.contents = identity.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** Adds a value to the document. */
      add(value) {
        if (assertCollection(this.contents))
          this.contents.add(value);
      }
      /** Adds a value to the document. */
      addIn(path19, value) {
        if (assertCollection(this.contents))
          this.contents.addIn(path19, value);
      }
      /**
       * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
       *
       * If `node` already has an anchor, `name` is ignored.
       * Otherwise, the `node.anchor` value will be set to `name`,
       * or if an anchor with that name is already present in the document,
       * `name` will be used as a prefix for a new unique anchor.
       * If `name` is undefined, the generated anchor will use 'a' as a prefix.
       */
      createAlias(node, name) {
        if (!node.anchor) {
          const prev = anchors.anchorNames(this);
          node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          !name || prev.has(name) ? anchors.findNewAnchor(name || "a", prev) : name;
        }
        return new Alias.Alias(node.anchor);
      }
      createNode(value, replacer, options) {
        let _replacer = void 0;
        if (typeof replacer === "function") {
          value = replacer.call({ "": value }, "", value);
          _replacer = replacer;
        } else if (Array.isArray(replacer)) {
          const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
          const asStr = replacer.filter(keyToStr).map(String);
          if (asStr.length > 0)
            replacer = replacer.concat(asStr);
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
        const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(
          this,
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          anchorPrefix || "a"
        );
        const ctx = {
          aliasDuplicateObjects: aliasDuplicateObjects ?? true,
          keepUndefined: keepUndefined ?? false,
          onAnchor,
          onTagObj,
          replacer: _replacer,
          schema: this.schema,
          sourceObjects
        };
        const node = createNode.createNode(value, tag, ctx);
        if (flow && identity.isCollection(node))
          node.flow = true;
        setAnchors();
        return node;
      }
      /**
       * Convert a key and a value into a `Pair` using the current schema,
       * recursively wrapping all values as `Scalar` or `Collection` nodes.
       */
      createPair(key, value, options = {}) {
        const k = this.createNode(key, null, options);
        const v = this.createNode(value, null, options);
        return new Pair.Pair(k, v);
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        return assertCollection(this.contents) ? this.contents.delete(key) : false;
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path19) {
        if (Collection.isEmptyPath(path19)) {
          if (this.contents == null)
            return false;
          this.contents = null;
          return true;
        }
        return assertCollection(this.contents) ? this.contents.deleteIn(path19) : false;
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      get(key, keepScalar) {
        return identity.isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
      }
      /**
       * Returns item at `path`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path19, keepScalar) {
        if (Collection.isEmptyPath(path19))
          return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
        return identity.isCollection(this.contents) ? this.contents.getIn(path19, keepScalar) : void 0;
      }
      /**
       * Checks if the document includes a value with the key `key`.
       */
      has(key) {
        return identity.isCollection(this.contents) ? this.contents.has(key) : false;
      }
      /**
       * Checks if the document includes a value at `path`.
       */
      hasIn(path19) {
        if (Collection.isEmptyPath(path19))
          return this.contents !== void 0;
        return identity.isCollection(this.contents) ? this.contents.hasIn(path19) : false;
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      set(key, value) {
        if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, [key], value);
        } else if (assertCollection(this.contents)) {
          this.contents.set(key, value);
        }
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path19, value) {
        if (Collection.isEmptyPath(path19)) {
          this.contents = value;
        } else if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, Array.from(path19), value);
        } else if (assertCollection(this.contents)) {
          this.contents.setIn(path19, value);
        }
      }
      /**
       * Change the YAML version and schema used by the document.
       * A `null` version disables support for directives, explicit tags, anchors, and aliases.
       * It also requires the `schema` option to be given as a `Schema` instance value.
       *
       * Overrides all previously set schema options.
       */
      setSchema(version, options = {}) {
        if (typeof version === "number")
          version = String(version);
        let opt;
        switch (version) {
          case "1.1":
            if (this.directives)
              this.directives.yaml.version = "1.1";
            else
              this.directives = new directives.Directives({ version: "1.1" });
            opt = { resolveKnownTags: false, schema: "yaml-1.1" };
            break;
          case "1.2":
          case "next":
            if (this.directives)
              this.directives.yaml.version = version;
            else
              this.directives = new directives.Directives({ version });
            opt = { resolveKnownTags: true, schema: "core" };
            break;
          case null:
            if (this.directives)
              delete this.directives;
            opt = null;
            break;
          default: {
            const sv = JSON.stringify(version);
            throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
          }
        }
        if (options.schema instanceof Object)
          this.schema = options.schema;
        else if (opt)
          this.schema = new Schema.Schema(Object.assign(opt, options));
        else
          throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
      }
      // json & jsonArg are only used from toJSON()
      toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc: this,
          keep: !json,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
      /**
       * A JSON representation of the document `contents`.
       *
       * @param jsonArg Used by `JSON.stringify` to indicate the array index or
       *   property name.
       */
      toJSON(jsonArg, onAnchor) {
        return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
      }
      /** A YAML representation of the document. */
      toString(options = {}) {
        if (this.errors.length > 0)
          throw new Error("Document with errors cannot be stringified");
        if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
          const s = JSON.stringify(options.indent);
          throw new Error(`"indent" option must be a positive integer, not ${s}`);
        }
        return stringifyDocument.stringifyDocument(this, options);
      }
    };
    function assertCollection(contents) {
      if (identity.isCollection(contents))
        return true;
      throw new Error("Expected a YAML collection as document contents");
    }
    exports.Document = Document;
  }
});

// node_modules/yaml/dist/errors.js
var require_errors = __commonJS({
  "node_modules/yaml/dist/errors.js"(exports) {
    "use strict";
    var YAMLError = class extends Error {
      constructor(name, pos, code, message) {
        super();
        this.name = name;
        this.code = code;
        this.message = message;
        this.pos = pos;
      }
    };
    var YAMLParseError = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLParseError", pos, code, message);
      }
    };
    var YAMLWarning = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLWarning", pos, code, message);
      }
    };
    var prettifyError = (src, lc) => (error) => {
      if (error.pos[0] === -1)
        return;
      error.linePos = error.pos.map((pos) => lc.linePos(pos));
      const { line, col } = error.linePos[0];
      error.message += ` at line ${line}, column ${col}`;
      let ci = col - 1;
      let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
      if (ci >= 60 && lineStr.length > 80) {
        const trimStart = Math.min(ci - 39, lineStr.length - 79);
        lineStr = "\u2026" + lineStr.substring(trimStart);
        ci -= trimStart - 1;
      }
      if (lineStr.length > 80)
        lineStr = lineStr.substring(0, 79) + "\u2026";
      if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
        let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
        if (prev.length > 80)
          prev = prev.substring(0, 79) + "\u2026\n";
        lineStr = prev + lineStr;
      }
      if (/[^ ]/.test(lineStr)) {
        let count = 1;
        const end = error.linePos[1];
        if (end?.line === line && end.col > col) {
          count = Math.max(1, Math.min(end.col - col, 80 - ci));
        }
        const pointer = " ".repeat(ci) + "^".repeat(count);
        error.message += `:

${lineStr}
${pointer}
`;
      }
    };
    exports.YAMLError = YAMLError;
    exports.YAMLParseError = YAMLParseError;
    exports.YAMLWarning = YAMLWarning;
    exports.prettifyError = prettifyError;
  }
});

// node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = __commonJS({
  "node_modules/yaml/dist/compose/resolve-props.js"(exports) {
    "use strict";
    function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
      let spaceBefore = false;
      let atNewline = startOnNewline;
      let hasSpace = startOnNewline;
      let comment = "";
      let commentSep = "";
      let hasNewline = false;
      let reqSpace = false;
      let tab = null;
      let anchor = null;
      let tag = null;
      let newlineAfterProp = null;
      let comma = null;
      let found = null;
      let start = null;
      for (const token of tokens) {
        if (reqSpace) {
          if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
            onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
          reqSpace = false;
        }
        if (tab) {
          if (atNewline && token.type !== "comment" && token.type !== "newline") {
            onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
          }
          tab = null;
        }
        switch (token.type) {
          case "space":
            if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
              tab = token;
            }
            hasSpace = true;
            break;
          case "comment": {
            if (!hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = token.source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += commentSep + cb;
            commentSep = "";
            atNewline = false;
            break;
          }
          case "newline":
            if (atNewline) {
              if (comment)
                comment += token.source;
              else if (!found || indicator !== "seq-item-ind")
                spaceBefore = true;
            } else
              commentSep += token.source;
            atNewline = true;
            hasNewline = true;
            if (anchor || tag)
              newlineAfterProp = token;
            hasSpace = true;
            break;
          case "anchor":
            if (anchor)
              onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
            if (token.source.endsWith(":"))
              onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
            anchor = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          case "tag": {
            if (tag)
              onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
            tag = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          }
          case indicator:
            if (anchor || tag)
              onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
            if (found)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
            found = token;
            atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
            hasSpace = false;
            break;
          case "comma":
            if (flow) {
              if (comma)
                onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
              comma = token;
              atNewline = false;
              hasSpace = false;
              break;
            }
          // else fallthrough
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
            atNewline = false;
            hasSpace = false;
        }
      }
      const last = tokens[tokens.length - 1];
      const end = last ? last.offset + last.source.length : offset;
      if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
        onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
      }
      if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
        onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
      return {
        comma,
        found,
        spaceBefore,
        comment,
        hasNewline,
        anchor,
        tag,
        newlineAfterProp,
        end,
        start: start ?? end
      };
    }
    exports.resolveProps = resolveProps;
  }
});

// node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = __commonJS({
  "node_modules/yaml/dist/compose/util-contains-newline.js"(exports) {
    "use strict";
    function containsNewline(key) {
      if (!key)
        return null;
      switch (key.type) {
        case "alias":
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          if (key.source.includes("\n"))
            return true;
          if (key.end) {
            for (const st of key.end)
              if (st.type === "newline")
                return true;
          }
          return false;
        case "flow-collection":
          for (const it of key.items) {
            for (const st of it.start)
              if (st.type === "newline")
                return true;
            if (it.sep) {
              for (const st of it.sep)
                if (st.type === "newline")
                  return true;
            }
            if (containsNewline(it.key) || containsNewline(it.value))
              return true;
          }
          return false;
        default:
          return true;
      }
    }
    exports.containsNewline = containsNewline;
  }
});

// node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = __commonJS({
  "node_modules/yaml/dist/compose/util-flow-indent-check.js"(exports) {
    "use strict";
    var utilContainsNewline = require_util_contains_newline();
    function flowIndentCheck(indent, fc, onError) {
      if (fc?.type === "flow-collection") {
        const end = fc.end[0];
        if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) {
          const msg = "Flow end indicator should be more indented than parent";
          onError(end, "BAD_INDENT", msg, true);
        }
      }
    }
    exports.flowIndentCheck = flowIndentCheck;
  }
});

// node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = __commonJS({
  "node_modules/yaml/dist/compose/util-map-includes.js"(exports) {
    "use strict";
    var identity = require_identity();
    function mapIncludes(ctx, items, search) {
      const { uniqueKeys } = ctx.options;
      if (uniqueKeys === false)
        return false;
      const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity.isScalar(a) && identity.isScalar(b) && a.value === b.value;
      return items.some((pair) => isEqual(pair.key, search));
    }
    exports.mapIncludes = mapIncludes;
  }
});

// node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-map.js"(exports) {
    "use strict";
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    var utilMapIncludes = require_util_map_includes();
    var startColMsg = "All mapping items must start at the same column";
    function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
      const map = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      let offset = bm.offset;
      let commentEnd = null;
      for (const collItem of bm.items) {
        const { start, key, sep: sep5, value } = collItem;
        const keyProps = resolveProps.resolveProps(start, {
          indicator: "explicit-key-ind",
          next: key ?? sep5?.[0],
          offset,
          onError,
          parentIndent: bm.indent,
          startOnNewline: true
        });
        const implicitKey = !keyProps.found;
        if (implicitKey) {
          if (key) {
            if (key.type === "block-seq")
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
            else if ("indent" in key && key.indent !== bm.indent)
              onError(offset, "BAD_INDENT", startColMsg);
          }
          if (!keyProps.anchor && !keyProps.tag && !sep5) {
            commentEnd = keyProps.end;
            if (keyProps.comment) {
              if (map.comment)
                map.comment += "\n" + keyProps.comment;
              else
                map.comment = keyProps.comment;
            }
            continue;
          }
          if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
            onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
          }
        } else if (keyProps.found?.indent !== bm.indent) {
          onError(offset, "BAD_INDENT", startColMsg);
        }
        ctx.atKey = true;
        const keyStart = keyProps.end;
        const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
        ctx.atKey = false;
        if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
          onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
        const valueProps = resolveProps.resolveProps(sep5 ?? [], {
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: bm.indent,
          startOnNewline: !key || key.type === "block-scalar"
        });
        offset = valueProps.end;
        if (valueProps.found) {
          if (implicitKey) {
            if (value?.type === "block-map" && !valueProps.hasNewline)
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
            if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
              onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep5, null, valueProps, onError);
          if (ctx.schema.compat)
            utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
          offset = valueNode.range[2];
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        } else {
          if (implicitKey)
            onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
          if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        }
      }
      if (commentEnd && commentEnd < offset)
        onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
      map.range = [bm.offset, offset, commentEnd ?? offset];
      return map;
    }
    exports.resolveBlockMap = resolveBlockMap;
  }
});

// node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-seq.js"(exports) {
    "use strict";
    var YAMLSeq = require_YAMLSeq();
    var resolveProps = require_resolve_props();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLSeq.YAMLSeq;
      const seq = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = bs.offset;
      let commentEnd = null;
      for (const { start, value } of bs.items) {
        const props = resolveProps.resolveProps(start, {
          indicator: "seq-item-ind",
          next: value,
          offset,
          onError,
          parentIndent: bs.indent,
          startOnNewline: true
        });
        if (!props.found) {
          if (props.anchor || props.tag || value) {
            if (value?.type === "block-seq")
              onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
            else
              onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
          } else {
            commentEnd = props.end;
            if (props.comment)
              seq.comment = props.comment;
            continue;
          }
        }
        const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
        offset = node.range[2];
        seq.items.push(node);
      }
      seq.range = [bs.offset, offset, commentEnd ?? offset];
      return seq;
    }
    exports.resolveBlockSeq = resolveBlockSeq;
  }
});

// node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = __commonJS({
  "node_modules/yaml/dist/compose/resolve-end.js"(exports) {
    "use strict";
    function resolveEnd(end, offset, reqSpace, onError) {
      let comment = "";
      if (end) {
        let hasSpace = false;
        let sep5 = "";
        for (const token of end) {
          const { source, type } = token;
          switch (type) {
            case "space":
              hasSpace = true;
              break;
            case "comment": {
              if (reqSpace && !hasSpace)
                onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
              const cb = source.substring(1) || " ";
              if (!comment)
                comment = cb;
              else
                comment += sep5 + cb;
              sep5 = "";
              break;
            }
            case "newline":
              if (comment)
                sep5 += source;
              hasSpace = true;
              break;
            default:
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
          }
          offset += source.length;
        }
      }
      return { comment, offset };
    }
    exports.resolveEnd = resolveEnd;
  }
});

// node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = __commonJS({
  "node_modules/yaml/dist/compose/resolve-flow-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilMapIncludes = require_util_map_includes();
    var blockMsg = "Block collections are not allowed within flow collections";
    var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
    function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
      const isMap = fc.start.source === "{";
      const fcName = isMap ? "flow map" : "flow sequence";
      const NodeClass = tag?.nodeClass ?? (isMap ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq);
      const coll = new NodeClass(ctx.schema);
      coll.flow = true;
      const atRoot = ctx.atRoot;
      if (atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = fc.offset + fc.start.source.length;
      for (let i = 0; i < fc.items.length; ++i) {
        const collItem = fc.items[i];
        const { start, key, sep: sep5, value } = collItem;
        const props = resolveProps.resolveProps(start, {
          flow: fcName,
          indicator: "explicit-key-ind",
          next: key ?? sep5?.[0],
          offset,
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (!props.found) {
          if (!props.anchor && !props.tag && !sep5 && !value) {
            if (i === 0 && props.comma)
              onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
            else if (i < fc.items.length - 1)
              onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
            if (props.comment) {
              if (coll.comment)
                coll.comment += "\n" + props.comment;
              else
                coll.comment = props.comment;
            }
            offset = props.end;
            continue;
          }
          if (!isMap && ctx.options.strict && utilContainsNewline.containsNewline(key))
            onError(
              key,
              // checked by containsNewline()
              "MULTILINE_IMPLICIT_KEY",
              "Implicit keys of flow sequence pairs need to be on a single line"
            );
        }
        if (i === 0) {
          if (props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
        } else {
          if (!props.comma)
            onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
          if (props.comment) {
            let prevItemComment = "";
            loop: for (const st of start) {
              switch (st.type) {
                case "comma":
                case "space":
                  break;
                case "comment":
                  prevItemComment = st.source.substring(1);
                  break loop;
                default:
                  break loop;
              }
            }
            if (prevItemComment) {
              let prev = coll.items[coll.items.length - 1];
              if (identity.isPair(prev))
                prev = prev.value ?? prev.key;
              if (prev.comment)
                prev.comment += "\n" + prevItemComment;
              else
                prev.comment = prevItemComment;
              props.comment = props.comment.substring(prevItemComment.length + 1);
            }
          }
        }
        if (!isMap && !sep5 && !props.found) {
          const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep5, null, props, onError);
          coll.items.push(valueNode);
          offset = valueNode.range[2];
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else {
          ctx.atKey = true;
          const keyStart = props.end;
          const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
          if (isBlock(key))
            onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
          ctx.atKey = false;
          const valueProps = resolveProps.resolveProps(sep5 ?? [], {
            flow: fcName,
            indicator: "map-value-ind",
            next: value,
            offset: keyNode.range[2],
            onError,
            parentIndent: fc.indent,
            startOnNewline: false
          });
          if (valueProps.found) {
            if (!isMap && !props.found && ctx.options.strict) {
              if (sep5)
                for (const st of sep5) {
                  if (st === valueProps.found)
                    break;
                  if (st.type === "newline") {
                    onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                    break;
                  }
                }
              if (props.start < valueProps.found.offset - 1024)
                onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
            }
          } else if (value) {
            if ("source" in value && value.source?.[0] === ":")
              onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
            else
              onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep5, null, valueProps, onError) : null;
          if (valueNode) {
            if (isBlock(value))
              onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
          } else if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          if (isMap) {
            const map = coll;
            if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
              onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
            map.items.push(pair);
          } else {
            const map = new YAMLMap.YAMLMap(ctx.schema);
            map.flow = true;
            map.items.push(pair);
            const endRange = (valueNode ?? keyNode).range;
            map.range = [keyNode.range[0], endRange[1], endRange[2]];
            coll.items.push(map);
          }
          offset = valueNode ? valueNode.range[2] : valueProps.end;
        }
      }
      const expectedEnd = isMap ? "}" : "]";
      const [ce, ...ee] = fc.end;
      let cePos = offset;
      if (ce?.source === expectedEnd)
        cePos = ce.offset + ce.source.length;
      else {
        const name = fcName[0].toUpperCase() + fcName.substring(1);
        const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
        onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
        if (ce && ce.source.length !== 1)
          ee.unshift(ce);
      }
      if (ee.length > 0) {
        const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
        if (end.comment) {
          if (coll.comment)
            coll.comment += "\n" + end.comment;
          else
            coll.comment = end.comment;
        }
        coll.range = [fc.offset, cePos, end.offset];
      } else {
        coll.range = [fc.offset, cePos, cePos];
      }
      return coll;
    }
    exports.resolveFlowCollection = resolveFlowCollection;
  }
});

// node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = __commonJS({
  "node_modules/yaml/dist/compose/compose-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveBlockMap = require_resolve_block_map();
    var resolveBlockSeq = require_resolve_block_seq();
    var resolveFlowCollection = require_resolve_flow_collection();
    function resolveCollection(CN, ctx, token, onError, tagName, tag) {
      const coll = token.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
      const Coll = coll.constructor;
      if (tagName === "!" || tagName === Coll.tagName) {
        coll.tag = Coll.tagName;
        return coll;
      }
      if (tagName)
        coll.tag = tagName;
      return coll;
    }
    function composeCollection(CN, ctx, token, props, onError) {
      const tagToken = props.tag;
      const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
      if (token.type === "block-seq") {
        const { anchor, newlineAfterProp: nl } = props;
        const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
        if (lastProp && (!nl || nl.offset < lastProp.offset)) {
          const message = "Missing newline after block sequence props";
          onError(lastProp, "MISSING_CHAR", message);
        }
      }
      const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
      if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.YAMLSeq.tagName && expType === "seq") {
        return resolveCollection(CN, ctx, token, onError, tagName);
      }
      let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
      if (!tag) {
        const kt = ctx.schema.knownTags[tagName];
        if (kt?.collection === expType) {
          ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
          tag = kt;
        } else {
          if (kt) {
            onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
          } else {
            onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
          }
          return resolveCollection(CN, ctx, token, onError, tagName);
        }
      }
      const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
      const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
      const node = identity.isNode(res) ? res : new Scalar.Scalar(res);
      node.range = coll.range;
      node.tag = tagName;
      if (tag?.format)
        node.format = tag.format;
      return node;
    }
    exports.composeCollection = composeCollection;
  }
});

// node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function resolveBlockScalar(ctx, scalar, onError) {
      const start = scalar.offset;
      const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
      if (!header)
        return { value: "", type: null, comment: "", range: [start, start, start] };
      const type = header.mode === ">" ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
      const lines = scalar.source ? splitLines(scalar.source) : [];
      let chompStart = lines.length;
      for (let i = lines.length - 1; i >= 0; --i) {
        const content = lines[i][1];
        if (content === "" || content === "\r")
          chompStart = i;
        else
          break;
      }
      if (chompStart === 0) {
        const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
        let end2 = start + header.length;
        if (scalar.source)
          end2 += scalar.source.length;
        return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
      }
      let trimIndent = scalar.indent + header.indent;
      let offset = scalar.offset + header.length;
      let contentStart = 0;
      for (let i = 0; i < chompStart; ++i) {
        const [indent, content] = lines[i];
        if (content === "" || content === "\r") {
          if (header.indent === 0 && indent.length > trimIndent)
            trimIndent = indent.length;
        } else {
          if (indent.length < trimIndent) {
            const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
            onError(offset + indent.length, "MISSING_CHAR", message);
          }
          if (header.indent === 0)
            trimIndent = indent.length;
          contentStart = i;
          if (trimIndent === 0 && !ctx.atRoot) {
            const message = "Block scalar values in collections must be indented";
            onError(offset, "BAD_INDENT", message);
          }
          break;
        }
        offset += indent.length + content.length + 1;
      }
      for (let i = lines.length - 1; i >= chompStart; --i) {
        if (lines[i][0].length > trimIndent)
          chompStart = i + 1;
      }
      let value = "";
      let sep5 = "";
      let prevMoreIndented = false;
      for (let i = 0; i < contentStart; ++i)
        value += lines[i][0].slice(trimIndent) + "\n";
      for (let i = contentStart; i < chompStart; ++i) {
        let [indent, content] = lines[i];
        offset += indent.length + content.length + 1;
        const crlf = content[content.length - 1] === "\r";
        if (crlf)
          content = content.slice(0, -1);
        if (content && indent.length < trimIndent) {
          const src = header.indent ? "explicit indentation indicator" : "first line";
          const message = `Block scalar lines must not be less indented than their ${src}`;
          onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
          indent = "";
        }
        if (type === Scalar.Scalar.BLOCK_LITERAL) {
          value += sep5 + indent.slice(trimIndent) + content;
          sep5 = "\n";
        } else if (indent.length > trimIndent || content[0] === "	") {
          if (sep5 === " ")
            sep5 = "\n";
          else if (!prevMoreIndented && sep5 === "\n")
            sep5 = "\n\n";
          value += sep5 + indent.slice(trimIndent) + content;
          sep5 = "\n";
          prevMoreIndented = true;
        } else if (content === "") {
          if (sep5 === "\n")
            value += "\n";
          else
            sep5 = "\n";
        } else {
          value += sep5 + content;
          sep5 = " ";
          prevMoreIndented = false;
        }
      }
      switch (header.chomp) {
        case "-":
          break;
        case "+":
          for (let i = chompStart; i < lines.length; ++i)
            value += "\n" + lines[i][0].slice(trimIndent);
          if (value[value.length - 1] !== "\n")
            value += "\n";
          break;
        default:
          value += "\n";
      }
      const end = start + header.length + scalar.source.length;
      return { value, type, comment: header.comment, range: [start, end, end] };
    }
    function parseBlockScalarHeader({ offset, props }, strict, onError) {
      if (props[0].type !== "block-scalar-header") {
        onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
        return null;
      }
      const { source } = props[0];
      const mode = source[0];
      let indent = 0;
      let chomp = "";
      let error = -1;
      for (let i = 1; i < source.length; ++i) {
        const ch = source[i];
        if (!chomp && (ch === "-" || ch === "+"))
          chomp = ch;
        else {
          const n = Number(ch);
          if (!indent && n)
            indent = n;
          else if (error === -1)
            error = offset + i;
        }
      }
      if (error !== -1)
        onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
      let hasSpace = false;
      let comment = "";
      let length = source.length;
      for (let i = 1; i < props.length; ++i) {
        const token = props[i];
        switch (token.type) {
          case "space":
            hasSpace = true;
          // fallthrough
          case "newline":
            length += token.source.length;
            break;
          case "comment":
            if (strict && !hasSpace) {
              const message = "Comments must be separated from other tokens by white space characters";
              onError(token, "MISSING_CHAR", message);
            }
            length += token.source.length;
            comment = token.source.substring(1);
            break;
          case "error":
            onError(token, "UNEXPECTED_TOKEN", token.message);
            length += token.source.length;
            break;
          /* istanbul ignore next should not happen */
          default: {
            const message = `Unexpected token in block scalar header: ${token.type}`;
            onError(token, "UNEXPECTED_TOKEN", message);
            const ts = token.source;
            if (ts && typeof ts === "string")
              length += ts.length;
          }
        }
      }
      return { mode, indent, chomp, comment, length };
    }
    function splitLines(source) {
      const split = source.split(/\n( *)/);
      const first = split[0];
      const m = first.match(/^( *)/);
      const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
      const lines = [line0];
      for (let i = 1; i < split.length; i += 2)
        lines.push([split[i], split[i + 1]]);
      return lines;
    }
    exports.resolveBlockScalar = resolveBlockScalar;
  }
});

// node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = __commonJS({
  "node_modules/yaml/dist/compose/resolve-flow-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var resolveEnd = require_resolve_end();
    function resolveFlowScalar(scalar, strict, onError) {
      const { offset, type, source, end } = scalar;
      let _type;
      let value;
      const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
      switch (type) {
        case "scalar":
          _type = Scalar.Scalar.PLAIN;
          value = plainValue(source, _onError);
          break;
        case "single-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_SINGLE;
          value = singleQuotedValue(source, _onError);
          break;
        case "double-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_DOUBLE;
          value = doubleQuotedValue(source, _onError);
          break;
        /* istanbul ignore next should not happen */
        default:
          onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
          return {
            value: "",
            type: null,
            comment: "",
            range: [offset, offset + source.length, offset + source.length]
          };
      }
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
      return {
        value,
        type: _type,
        comment: re.comment,
        range: [offset, valueEnd, re.offset]
      };
    }
    function plainValue(source, onError) {
      let badChar = "";
      switch (source[0]) {
        /* istanbul ignore next should not happen */
        case "	":
          badChar = "a tab character";
          break;
        case ",":
          badChar = "flow indicator character ,";
          break;
        case "%":
          badChar = "directive indicator character %";
          break;
        case "|":
        case ">": {
          badChar = `block scalar indicator ${source[0]}`;
          break;
        }
        case "@":
        case "`": {
          badChar = `reserved character ${source[0]}`;
          break;
        }
      }
      if (badChar)
        onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
      return foldLines(source);
    }
    function singleQuotedValue(source, onError) {
      if (source[source.length - 1] !== "'" || source.length === 1)
        onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
      return foldLines(source.slice(1, -1)).replace(/''/g, "'");
    }
    function foldLines(source) {
      let first, line;
      try {
        first = new RegExp("(.*?)(?<![ 	])[ 	]*\r?\n", "sy");
        line = new RegExp("[ 	]*(.*?)(?:(?<![ 	])[ 	]*)?\r?\n", "sy");
      } catch {
        first = /(.*?)[ \t]*\r?\n/sy;
        line = /[ \t]*(.*?)[ \t]*\r?\n/sy;
      }
      let match = first.exec(source);
      if (!match)
        return source;
      let res = match[1];
      let sep5 = " ";
      let pos = first.lastIndex;
      line.lastIndex = pos;
      while (match = line.exec(source)) {
        if (match[1] === "") {
          if (sep5 === "\n")
            res += sep5;
          else
            sep5 = "\n";
        } else {
          res += sep5 + match[1];
          sep5 = " ";
        }
        pos = line.lastIndex;
      }
      const last = /[ \t]*(.*)/sy;
      last.lastIndex = pos;
      match = last.exec(source);
      return res + sep5 + (match?.[1] ?? "");
    }
    function doubleQuotedValue(source, onError) {
      let res = "";
      for (let i = 1; i < source.length - 1; ++i) {
        const ch = source[i];
        if (ch === "\r" && source[i + 1] === "\n")
          continue;
        if (ch === "\n") {
          const { fold, offset } = foldNewline(source, i);
          res += fold;
          i = offset;
        } else if (ch === "\\") {
          let next = source[++i];
          const cc = escapeCodes[next];
          if (cc)
            res += cc;
          else if (next === "\n") {
            next = source[i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "\r" && source[i + 1] === "\n") {
            next = source[++i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "x" || next === "u" || next === "U") {
            const length = next === "x" ? 2 : next === "u" ? 4 : 8;
            res += parseCharCode(source, i + 1, length, onError);
            i += length;
          } else {
            const raw = source.substr(i - 1, 2);
            onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
            res += raw;
          }
        } else if (ch === " " || ch === "	") {
          const wsStart = i;
          let next = source[i + 1];
          while (next === " " || next === "	")
            next = source[++i + 1];
          if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n"))
            res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
        } else {
          res += ch;
        }
      }
      if (source[source.length - 1] !== '"' || source.length === 1)
        onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
      return res;
    }
    function foldNewline(source, offset) {
      let fold = "";
      let ch = source[offset + 1];
      while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
        if (ch === "\r" && source[offset + 2] !== "\n")
          break;
        if (ch === "\n")
          fold += "\n";
        offset += 1;
        ch = source[offset + 1];
      }
      if (!fold)
        fold = " ";
      return { fold, offset };
    }
    var escapeCodes = {
      "0": "\0",
      // null character
      a: "\x07",
      // bell character
      b: "\b",
      // backspace
      e: "\x1B",
      // escape character
      f: "\f",
      // form feed
      n: "\n",
      // line feed
      r: "\r",
      // carriage return
      t: "	",
      // horizontal tab
      v: "\v",
      // vertical tab
      N: "\x85",
      // Unicode next line
      _: "\xA0",
      // Unicode non-breaking space
      L: "\u2028",
      // Unicode line separator
      P: "\u2029",
      // Unicode paragraph separator
      " ": " ",
      '"': '"',
      "/": "/",
      "\\": "\\",
      "	": "	"
    };
    function parseCharCode(source, offset, length, onError) {
      const cc = source.substr(offset, length);
      const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
      const code = ok ? parseInt(cc, 16) : NaN;
      try {
        return String.fromCodePoint(code);
      } catch {
        const raw = source.substr(offset - 2, length + 2);
        onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
        return raw;
      }
    }
    exports.resolveFlowScalar = resolveFlowScalar;
  }
});

// node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = __commonJS({
  "node_modules/yaml/dist/compose/compose-scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    function composeScalar(ctx, token, tagToken, onError) {
      const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
      const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
      let tag;
      if (ctx.options.stringKeys && ctx.atKey) {
        tag = ctx.schema[identity.SCALAR];
      } else if (tagName)
        tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
      else if (token.type === "scalar")
        tag = findScalarTagByTest(ctx, value, token, onError);
      else
        tag = ctx.schema[identity.SCALAR];
      let scalar;
      try {
        const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
        scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
        scalar = new Scalar.Scalar(value);
      }
      scalar.range = range;
      scalar.source = value;
      if (type)
        scalar.type = type;
      if (tagName)
        scalar.tag = tagName;
      if (tag.format)
        scalar.format = tag.format;
      if (comment)
        scalar.comment = comment;
      return scalar;
    }
    function findScalarTagByName(schema, value, tagName, tagToken, onError) {
      if (tagName === "!")
        return schema[identity.SCALAR];
      const matchWithTest = [];
      for (const tag of schema.tags) {
        if (!tag.collection && tag.tag === tagName) {
          if (tag.default && tag.test)
            matchWithTest.push(tag);
          else
            return tag;
        }
      }
      for (const tag of matchWithTest)
        if (tag.test?.test(value))
          return tag;
      const kt = schema.knownTags[tagName];
      if (kt && !kt.collection) {
        schema.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
        return kt;
      }
      onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
      return schema[identity.SCALAR];
    }
    function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
      const tag = schema.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema[identity.SCALAR];
      if (schema.compat) {
        const compat = schema.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema[identity.SCALAR];
        if (tag.tag !== compat.tag) {
          const ts = directives.tagString(tag.tag);
          const cs = directives.tagString(compat.tag);
          const msg = `Value may be parsed as either ${ts} or ${cs}`;
          onError(token, "TAG_RESOLVE_FAILED", msg, true);
        }
      }
      return tag;
    }
    exports.composeScalar = composeScalar;
  }
});

// node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = __commonJS({
  "node_modules/yaml/dist/compose/util-empty-scalar-position.js"(exports) {
    "use strict";
    function emptyScalarPosition(offset, before, pos) {
      if (before) {
        pos ?? (pos = before.length);
        for (let i = pos - 1; i >= 0; --i) {
          let st = before[i];
          switch (st.type) {
            case "space":
            case "comment":
            case "newline":
              offset -= st.source.length;
              continue;
          }
          st = before[++i];
          while (st?.type === "space") {
            offset += st.source.length;
            st = before[++i];
          }
          break;
        }
      }
      return offset;
    }
    exports.emptyScalarPosition = emptyScalarPosition;
  }
});

// node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = __commonJS({
  "node_modules/yaml/dist/compose/compose-node.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var composeCollection = require_compose_collection();
    var composeScalar = require_compose_scalar();
    var resolveEnd = require_resolve_end();
    var utilEmptyScalarPosition = require_util_empty_scalar_position();
    var CN = { composeNode, composeEmptyNode };
    function composeNode(ctx, token, props, onError) {
      const atKey = ctx.atKey;
      const { spaceBefore, comment, anchor, tag } = props;
      let node;
      let isSrcToken = true;
      switch (token.type) {
        case "alias":
          node = composeAlias(ctx, token, onError);
          if (anchor || tag)
            onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
          break;
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "block-scalar":
          node = composeScalar.composeScalar(ctx, token, tag, onError);
          if (anchor)
            node.anchor = anchor.source.substring(1);
          break;
        case "block-map":
        case "block-seq":
        case "flow-collection":
          try {
            node = composeCollection.composeCollection(CN, ctx, token, props, onError);
            if (anchor)
              node.anchor = anchor.source.substring(1);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            onError(token, "RESOURCE_EXHAUSTION", message);
          }
          break;
        default: {
          const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
          onError(token, "UNEXPECTED_TOKEN", message);
          isSrcToken = false;
        }
      }
      node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
      if (anchor && node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      if (atKey && ctx.options.stringKeys && (!identity.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
        const msg = "With stringKeys, all keys must be strings";
        onError(tag ?? token, "NON_STRING_KEY", msg);
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        if (token.type === "scalar" && token.source === "")
          node.comment = comment;
        else
          node.commentBefore = comment;
      }
      if (ctx.options.keepSourceTokens && isSrcToken)
        node.srcToken = token;
      return node;
    }
    function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
      const token = {
        type: "scalar",
        offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
        indent: -1,
        source: ""
      };
      const node = composeScalar.composeScalar(ctx, token, tag, onError);
      if (anchor) {
        node.anchor = anchor.source.substring(1);
        if (node.anchor === "")
          onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        node.comment = comment;
        node.range[2] = end;
      }
      return node;
    }
    function composeAlias({ options }, { offset, source, end }, onError) {
      const alias = new Alias.Alias(source.substring(1));
      if (alias.source === "")
        onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
      if (alias.source.endsWith(":"))
        onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
      alias.range = [offset, valueEnd, re.offset];
      if (re.comment)
        alias.comment = re.comment;
      return alias;
    }
    exports.composeEmptyNode = composeEmptyNode;
    exports.composeNode = composeNode;
  }
});

// node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = __commonJS({
  "node_modules/yaml/dist/compose/compose-doc.js"(exports) {
    "use strict";
    var Document = require_Document();
    var composeNode = require_compose_node();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    function composeDoc(options, directives, { offset, start, value, end }, onError) {
      const opts = Object.assign({ _directives: directives }, options);
      const doc = new Document.Document(void 0, opts);
      const ctx = {
        atKey: false,
        atRoot: true,
        directives: doc.directives,
        options: doc.options,
        schema: doc.schema
      };
      const props = resolveProps.resolveProps(start, {
        indicator: "doc-start",
        next: value ?? end?.[0],
        offset,
        onError,
        parentIndent: 0,
        startOnNewline: true
      });
      if (props.found) {
        doc.directives.docStart = true;
        if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
          onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
      }
      doc.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
      const contentEnd = doc.contents.range[2];
      const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
      if (re.comment)
        doc.comment = re.comment;
      doc.range = [offset, contentEnd, re.offset];
      return doc;
    }
    exports.composeDoc = composeDoc;
  }
});

// node_modules/yaml/dist/compose/composer.js
var require_composer = __commonJS({
  "node_modules/yaml/dist/compose/composer.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var directives = require_directives();
    var Document = require_Document();
    var errors = require_errors();
    var identity = require_identity();
    var composeDoc = require_compose_doc();
    var resolveEnd = require_resolve_end();
    function getErrorPos(src) {
      if (typeof src === "number")
        return [src, src + 1];
      if (Array.isArray(src))
        return src.length === 2 ? src : [src[0], src[1]];
      const { offset, source } = src;
      return [offset, offset + (typeof source === "string" ? source.length : 1)];
    }
    function parsePrelude(prelude) {
      let comment = "";
      let atComment = false;
      let afterEmptyLine = false;
      for (let i = 0; i < prelude.length; ++i) {
        const source = prelude[i];
        switch (source[0]) {
          case "#":
            comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
            atComment = true;
            afterEmptyLine = false;
            break;
          case "%":
            if (prelude[i + 1]?.[0] !== "#")
              i += 1;
            atComment = false;
            break;
          default:
            if (!atComment)
              afterEmptyLine = true;
            atComment = false;
        }
      }
      return { comment, afterEmptyLine };
    }
    var Composer = class {
      constructor(options = {}) {
        this.doc = null;
        this.atDirectives = false;
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
        this.onError = (source, code, message, warning) => {
          const pos = getErrorPos(source);
          if (warning)
            this.warnings.push(new errors.YAMLWarning(pos, code, message));
          else
            this.errors.push(new errors.YAMLParseError(pos, code, message));
        };
        this.directives = new directives.Directives({ version: options.version || "1.2" });
        this.options = options;
      }
      decorate(doc, afterDoc) {
        const { comment, afterEmptyLine } = parsePrelude(this.prelude);
        if (comment) {
          const dc = doc.contents;
          if (afterDoc) {
            doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
          } else if (afterEmptyLine || doc.directives.docStart || !dc) {
            doc.commentBefore = comment;
          } else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
            let it = dc.items[0];
            if (identity.isPair(it))
              it = it.key;
            const cb = it.commentBefore;
            it.commentBefore = cb ? `${comment}
${cb}` : comment;
          } else {
            const cb = dc.commentBefore;
            dc.commentBefore = cb ? `${comment}
${cb}` : comment;
          }
        }
        if (afterDoc) {
          for (let i = 0; i < this.errors.length; ++i)
            doc.errors.push(this.errors[i]);
          for (let i = 0; i < this.warnings.length; ++i)
            doc.warnings.push(this.warnings[i]);
        } else {
          doc.errors = this.errors;
          doc.warnings = this.warnings;
        }
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
      }
      /**
       * Current stream status information.
       *
       * Mostly useful at the end of input for an empty stream.
       */
      streamInfo() {
        return {
          comment: parsePrelude(this.prelude).comment,
          directives: this.directives,
          errors: this.errors,
          warnings: this.warnings
        };
      }
      /**
       * Compose tokens into documents.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *compose(tokens, forceDoc = false, endOffset = -1) {
        for (const token of tokens)
          yield* this.next(token);
        yield* this.end(forceDoc, endOffset);
      }
      /** Advance the composer by one CST token. */
      *next(token) {
        if (node_process.env.LOG_STREAM)
          console.dir(token, { depth: null });
        switch (token.type) {
          case "directive":
            this.directives.add(token.source, (offset, message, warning) => {
              const pos = getErrorPos(token);
              pos[0] += offset;
              this.onError(pos, "BAD_DIRECTIVE", message, warning);
            });
            this.prelude.push(token.source);
            this.atDirectives = true;
            break;
          case "document": {
            const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
            if (this.atDirectives && !doc.directives.docStart)
              this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
            this.decorate(doc, false);
            if (this.doc)
              yield this.doc;
            this.doc = doc;
            this.atDirectives = false;
            break;
          }
          case "byte-order-mark":
          case "space":
            break;
          case "comment":
          case "newline":
            this.prelude.push(token.source);
            break;
          case "error": {
            const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
            const error = new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
            if (this.atDirectives || !this.doc)
              this.errors.push(error);
            else
              this.doc.errors.push(error);
            break;
          }
          case "doc-end": {
            if (!this.doc) {
              const msg = "Unexpected doc-end without preceding document";
              this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
              break;
            }
            this.doc.directives.docEnd = true;
            const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
            this.decorate(this.doc, true);
            if (end.comment) {
              const dc = this.doc.comment;
              this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
            }
            this.doc.range[2] = end.offset;
            break;
          }
          default:
            this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
        }
      }
      /**
       * Call at end of input to yield any remaining document.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *end(forceDoc = false, endOffset = -1) {
        if (this.doc) {
          this.decorate(this.doc, true);
          yield this.doc;
          this.doc = null;
        } else if (forceDoc) {
          const opts = Object.assign({ _directives: this.directives }, this.options);
          const doc = new Document.Document(void 0, opts);
          if (this.atDirectives)
            this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
          doc.range = [0, endOffset, endOffset];
          this.decorate(doc, false);
          yield doc;
        }
      }
    };
    exports.Composer = Composer;
  }
});

// node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = __commonJS({
  "node_modules/yaml/dist/parse/cst-scalar.js"(exports) {
    "use strict";
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    var errors = require_errors();
    var stringifyString = require_stringifyString();
    function resolveAsScalar(token, strict = true, onError) {
      if (token) {
        const _onError = (pos, code, message) => {
          const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
          if (onError)
            onError(offset, code, message);
          else
            throw new errors.YAMLParseError([offset, offset + 1], code, message);
        };
        switch (token.type) {
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
          case "block-scalar":
            return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
        }
      }
      return null;
    }
    function createScalarToken(value, context) {
      const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey,
        indent: indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      const end = context.end ?? [
        { type: "newline", offset: -1, indent, source: "\n" }
      ];
      switch (source[0]) {
        case "|":
        case ">": {
          const he = source.indexOf("\n");
          const head = source.substring(0, he);
          const body = source.substring(he + 1) + "\n";
          const props = [
            { type: "block-scalar-header", offset, indent, source: head }
          ];
          if (!addEndtoBlockProps(props, end))
            props.push({ type: "newline", offset: -1, indent, source: "\n" });
          return { type: "block-scalar", offset, indent, props, source: body };
        }
        case '"':
          return { type: "double-quoted-scalar", offset, indent, source, end };
        case "'":
          return { type: "single-quoted-scalar", offset, indent, source, end };
        default:
          return { type: "scalar", offset, indent, source, end };
      }
    }
    function setScalarValue(token, value, context = {}) {
      let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
      let indent = "indent" in token ? token.indent : null;
      if (afterKey && typeof indent === "number")
        indent += 2;
      if (!type)
        switch (token.type) {
          case "single-quoted-scalar":
            type = "QUOTE_SINGLE";
            break;
          case "double-quoted-scalar":
            type = "QUOTE_DOUBLE";
            break;
          case "block-scalar": {
            const header = token.props[0];
            if (header.type !== "block-scalar-header")
              throw new Error("Invalid block scalar header");
            type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
            break;
          }
          default:
            type = "PLAIN";
        }
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey: implicitKey || indent === null,
        indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      switch (source[0]) {
        case "|":
        case ">":
          setBlockScalarValue(token, source);
          break;
        case '"':
          setFlowScalarValue(token, source, "double-quoted-scalar");
          break;
        case "'":
          setFlowScalarValue(token, source, "single-quoted-scalar");
          break;
        default:
          setFlowScalarValue(token, source, "scalar");
      }
    }
    function setBlockScalarValue(token, source) {
      const he = source.indexOf("\n");
      const head = source.substring(0, he);
      const body = source.substring(he + 1) + "\n";
      if (token.type === "block-scalar") {
        const header = token.props[0];
        if (header.type !== "block-scalar-header")
          throw new Error("Invalid block scalar header");
        header.source = head;
        token.source = body;
      } else {
        const { offset } = token;
        const indent = "indent" in token ? token.indent : -1;
        const props = [
          { type: "block-scalar-header", offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, "end" in token ? token.end : void 0))
          props.push({ type: "newline", offset: -1, indent, source: "\n" });
        for (const key of Object.keys(token))
          if (key !== "type" && key !== "offset")
            delete token[key];
        Object.assign(token, { type: "block-scalar", indent, props, source: body });
      }
    }
    function addEndtoBlockProps(props, end) {
      if (end)
        for (const st of end)
          switch (st.type) {
            case "space":
            case "comment":
              props.push(st);
              break;
            case "newline":
              props.push(st);
              return true;
          }
      return false;
    }
    function setFlowScalarValue(token, source, type) {
      switch (token.type) {
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          token.type = type;
          token.source = source;
          break;
        case "block-scalar": {
          const end = token.props.slice(1);
          let oa = source.length;
          if (token.props[0].type === "block-scalar-header")
            oa -= token.props[0].source.length;
          for (const tok of end)
            tok.offset += oa;
          delete token.props;
          Object.assign(token, { type, source, end });
          break;
        }
        case "block-map":
        case "block-seq": {
          const offset = token.offset + source.length;
          const nl = { type: "newline", offset, indent: token.indent, source: "\n" };
          delete token.items;
          Object.assign(token, { type, source, end: [nl] });
          break;
        }
        default: {
          const indent = "indent" in token ? token.indent : -1;
          const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
          for (const key of Object.keys(token))
            if (key !== "type" && key !== "offset")
              delete token[key];
          Object.assign(token, { type, indent, source, end });
        }
      }
    }
    exports.createScalarToken = createScalarToken;
    exports.resolveAsScalar = resolveAsScalar;
    exports.setScalarValue = setScalarValue;
  }
});

// node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = __commonJS({
  "node_modules/yaml/dist/parse/cst-stringify.js"(exports) {
    "use strict";
    var stringify = (cst) => "type" in cst ? stringifyToken(cst) : stringifyItem(cst);
    function stringifyToken(token) {
      switch (token.type) {
        case "block-scalar": {
          let res = "";
          for (const tok of token.props)
            res += stringifyToken(tok);
          return res + token.source;
        }
        case "block-map":
        case "block-seq": {
          let res = "";
          for (const item of token.items)
            res += stringifyItem(item);
          return res;
        }
        case "flow-collection": {
          let res = token.start.source;
          for (const item of token.items)
            res += stringifyItem(item);
          for (const st of token.end)
            res += st.source;
          return res;
        }
        case "document": {
          let res = stringifyItem(token);
          if (token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
        default: {
          let res = token.source;
          if ("end" in token && token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
      }
    }
    function stringifyItem({ start, key, sep: sep5, value }) {
      let res = "";
      for (const st of start)
        res += st.source;
      if (key)
        res += stringifyToken(key);
      if (sep5)
        for (const st of sep5)
          res += st.source;
      if (value)
        res += stringifyToken(value);
      return res;
    }
    exports.stringify = stringify;
  }
});

// node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = __commonJS({
  "node_modules/yaml/dist/parse/cst-visit.js"(exports) {
    "use strict";
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove item");
    function visit(cst, visitor) {
      if ("type" in cst && cst.type === "document")
        cst = { start: cst.start, value: cst.value };
      _visit(Object.freeze([]), cst, visitor);
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    visit.itemAtPath = (cst, path19) => {
      let item = cst;
      for (const [field, index] of path19) {
        const tok = item?.[field];
        if (tok && "items" in tok) {
          item = tok.items[index];
        } else
          return void 0;
      }
      return item;
    };
    visit.parentCollection = (cst, path19) => {
      const parent = visit.itemAtPath(cst, path19.slice(0, -1));
      const field = path19[path19.length - 1][0];
      const coll = parent?.[field];
      if (coll && "items" in coll)
        return coll;
      throw new Error("Parent collection not found");
    };
    function _visit(path19, item, visitor) {
      let ctrl = visitor(item, path19);
      if (typeof ctrl === "symbol")
        return ctrl;
      for (const field of ["key", "value"]) {
        const token = item[field];
        if (token && "items" in token) {
          for (let i = 0; i < token.items.length; ++i) {
            const ci = _visit(Object.freeze(path19.concat([[field, i]])), token.items[i], visitor);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              token.items.splice(i, 1);
              i -= 1;
            }
          }
          if (typeof ctrl === "function" && field === "key")
            ctrl = ctrl(item, path19);
        }
      }
      return typeof ctrl === "function" ? ctrl(item, path19) : ctrl;
    }
    exports.visit = visit;
  }
});

// node_modules/yaml/dist/parse/cst.js
var require_cst = __commonJS({
  "node_modules/yaml/dist/parse/cst.js"(exports) {
    "use strict";
    var cstScalar = require_cst_scalar();
    var cstStringify = require_cst_stringify();
    var cstVisit = require_cst_visit();
    var BOM = "\uFEFF";
    var DOCUMENT = "";
    var FLOW_END = "";
    var SCALAR = "";
    var isCollection = (token) => !!token && "items" in token;
    var isScalar = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
    function prettyToken(token) {
      switch (token) {
        case BOM:
          return "<BOM>";
        case DOCUMENT:
          return "<DOC>";
        case FLOW_END:
          return "<FLOW_END>";
        case SCALAR:
          return "<SCALAR>";
        default:
          return JSON.stringify(token);
      }
    }
    function tokenType(source) {
      switch (source) {
        case BOM:
          return "byte-order-mark";
        case DOCUMENT:
          return "doc-mode";
        case FLOW_END:
          return "flow-error-end";
        case SCALAR:
          return "scalar";
        case "---":
          return "doc-start";
        case "...":
          return "doc-end";
        case "":
        case "\n":
        case "\r\n":
          return "newline";
        case "-":
          return "seq-item-ind";
        case "?":
          return "explicit-key-ind";
        case ":":
          return "map-value-ind";
        case "{":
          return "flow-map-start";
        case "}":
          return "flow-map-end";
        case "[":
          return "flow-seq-start";
        case "]":
          return "flow-seq-end";
        case ",":
          return "comma";
      }
      switch (source[0]) {
        case " ":
        case "	":
          return "space";
        case "#":
          return "comment";
        case "%":
          return "directive-line";
        case "*":
          return "alias";
        case "&":
          return "anchor";
        case "!":
          return "tag";
        case "'":
          return "single-quoted-scalar";
        case '"':
          return "double-quoted-scalar";
        case "|":
        case ">":
          return "block-scalar-header";
      }
      return null;
    }
    exports.createScalarToken = cstScalar.createScalarToken;
    exports.resolveAsScalar = cstScalar.resolveAsScalar;
    exports.setScalarValue = cstScalar.setScalarValue;
    exports.stringify = cstStringify.stringify;
    exports.visit = cstVisit.visit;
    exports.BOM = BOM;
    exports.DOCUMENT = DOCUMENT;
    exports.FLOW_END = FLOW_END;
    exports.SCALAR = SCALAR;
    exports.isCollection = isCollection;
    exports.isScalar = isScalar;
    exports.prettyToken = prettyToken;
    exports.tokenType = tokenType;
  }
});

// node_modules/yaml/dist/parse/lexer.js
var require_lexer = __commonJS({
  "node_modules/yaml/dist/parse/lexer.js"(exports) {
    "use strict";
    var cst = require_cst();
    function isEmpty(ch) {
      switch (ch) {
        case void 0:
        case " ":
        case "\n":
        case "\r":
        case "	":
          return true;
        default:
          return false;
      }
    }
    var hexDigits = new Set("0123456789ABCDEFabcdef");
    var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
    var flowIndicatorChars = new Set(",[]{}");
    var invalidAnchorChars = new Set(" ,[]{}\n\r	");
    var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
    var Lexer = class {
      constructor() {
        this.atEnd = false;
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        this.buffer = "";
        this.flowKey = false;
        this.flowLevel = 0;
        this.indentNext = 0;
        this.indentValue = 0;
        this.lineEndPos = null;
        this.next = null;
        this.pos = 0;
      }
      /**
       * Generate YAML tokens from the `source` string. If `incomplete`,
       * a part of the last line may be left as a buffer for the next call.
       *
       * @returns A generator of lexical tokens
       */
      *lex(source, incomplete = false) {
        if (source) {
          if (typeof source !== "string")
            throw TypeError("source is not a string");
          this.buffer = this.buffer ? this.buffer + source : source;
          this.lineEndPos = null;
        }
        this.atEnd = !incomplete;
        let next = this.next ?? "stream";
        while (next && (incomplete || this.hasChars(1)))
          next = yield* this.parseNext(next);
      }
      atLineEnd() {
        let i = this.pos;
        let ch = this.buffer[i];
        while (ch === " " || ch === "	")
          ch = this.buffer[++i];
        if (!ch || ch === "#" || ch === "\n")
          return true;
        if (ch === "\r")
          return this.buffer[i + 1] === "\n";
        return false;
      }
      charAt(n) {
        return this.buffer[this.pos + n];
      }
      continueScalar(offset) {
        let ch = this.buffer[offset];
        if (this.indentNext > 0) {
          let indent = 0;
          while (ch === " ")
            ch = this.buffer[++indent + offset];
          if (ch === "\r") {
            const next = this.buffer[indent + offset + 1];
            if (next === "\n" || !next && !this.atEnd)
              return offset + indent + 1;
          }
          return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
        }
        if (ch === "-" || ch === ".") {
          const dt = this.buffer.substr(offset, 3);
          if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
            return -1;
        }
        return offset;
      }
      getLine() {
        let end = this.lineEndPos;
        if (typeof end !== "number" || end !== -1 && end < this.pos) {
          end = this.buffer.indexOf("\n", this.pos);
          this.lineEndPos = end;
        }
        if (end === -1)
          return this.atEnd ? this.buffer.substring(this.pos) : null;
        if (this.buffer[end - 1] === "\r")
          end -= 1;
        return this.buffer.substring(this.pos, end);
      }
      hasChars(n) {
        return this.pos + n <= this.buffer.length;
      }
      setNext(state2) {
        this.buffer = this.buffer.substring(this.pos);
        this.pos = 0;
        this.lineEndPos = null;
        this.next = state2;
        return null;
      }
      peek(n) {
        return this.buffer.substr(this.pos, n);
      }
      *parseNext(next) {
        switch (next) {
          case "stream":
            return yield* this.parseStream();
          case "line-start":
            return yield* this.parseLineStart();
          case "block-start":
            return yield* this.parseBlockStart();
          case "doc":
            return yield* this.parseDocument();
          case "flow":
            return yield* this.parseFlowCollection();
          case "quoted-scalar":
            return yield* this.parseQuotedScalar();
          case "block-scalar":
            return yield* this.parseBlockScalar();
          case "plain-scalar":
            return yield* this.parsePlainScalar();
        }
      }
      *parseStream() {
        let line = this.getLine();
        if (line === null)
          return this.setNext("stream");
        if (line[0] === cst.BOM) {
          yield* this.pushCount(1);
          line = line.substring(1);
        }
        if (line[0] === "%") {
          let dirEnd = line.length;
          let cs = line.indexOf("#");
          while (cs !== -1) {
            const ch = line[cs - 1];
            if (ch === " " || ch === "	") {
              dirEnd = cs - 1;
              break;
            } else {
              cs = line.indexOf("#", cs + 1);
            }
          }
          while (true) {
            const ch = line[dirEnd - 1];
            if (ch === " " || ch === "	")
              dirEnd -= 1;
            else
              break;
          }
          const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
          yield* this.pushCount(line.length - n);
          this.pushNewline();
          return "stream";
        }
        if (this.atLineEnd()) {
          const sp = yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - sp);
          yield* this.pushNewline();
          return "stream";
        }
        yield cst.DOCUMENT;
        return yield* this.parseLineStart();
      }
      *parseLineStart() {
        const ch = this.charAt(0);
        if (!ch && !this.atEnd)
          return this.setNext("line-start");
        if (ch === "-" || ch === ".") {
          if (!this.atEnd && !this.hasChars(4))
            return this.setNext("line-start");
          const s = this.peek(3);
          if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
            yield* this.pushCount(3);
            this.indentValue = 0;
            this.indentNext = 0;
            return s === "---" ? "doc" : "stream";
          }
        }
        this.indentValue = yield* this.pushSpaces(false);
        if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
          this.indentNext = this.indentValue;
        return yield* this.parseBlockStart();
      }
      *parseBlockStart() {
        const [ch0, ch1] = this.peek(2);
        if (!ch1 && !this.atEnd)
          return this.setNext("block-start");
        if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
          const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
          this.indentNext = this.indentValue + 1;
          this.indentValue += n;
          return "block-start";
        }
        return "doc";
      }
      *parseDocument() {
        yield* this.pushSpaces(true);
        const line = this.getLine();
        if (line === null)
          return this.setNext("doc");
        let n = yield* this.pushIndicators();
        switch (line[n]) {
          case "#":
            yield* this.pushCount(line.length - n);
          // fallthrough
          case void 0:
            yield* this.pushNewline();
            return yield* this.parseLineStart();
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel = 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            return "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "doc";
          case '"':
          case "'":
            return yield* this.parseQuotedScalar();
          case "|":
          case ">":
            n += yield* this.parseBlockScalarHeader();
            n += yield* this.pushSpaces(true);
            yield* this.pushCount(line.length - n);
            yield* this.pushNewline();
            return yield* this.parseBlockScalar();
          default:
            return yield* this.parsePlainScalar();
        }
      }
      *parseFlowCollection() {
        let nl, sp;
        let indent = -1;
        do {
          nl = yield* this.pushNewline();
          if (nl > 0) {
            sp = yield* this.pushSpaces(false);
            this.indentValue = indent = sp;
          } else {
            sp = 0;
          }
          sp += yield* this.pushSpaces(true);
        } while (nl + sp > 0);
        const line = this.getLine();
        if (line === null)
          return this.setNext("flow");
        if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
          const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
          if (!atFlowEndMarker) {
            this.flowLevel = 0;
            yield cst.FLOW_END;
            return yield* this.parseLineStart();
          }
        }
        let n = 0;
        while (line[n] === ",") {
          n += yield* this.pushCount(1);
          n += yield* this.pushSpaces(true);
          this.flowKey = false;
        }
        n += yield* this.pushIndicators();
        switch (line[n]) {
          case void 0:
            return "flow";
          case "#":
            yield* this.pushCount(line.length - n);
            return "flow";
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel += 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            this.flowKey = true;
            this.flowLevel -= 1;
            return this.flowLevel ? "flow" : "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "flow";
          case '"':
          case "'":
            this.flowKey = true;
            return yield* this.parseQuotedScalar();
          case ":": {
            const next = this.charAt(1);
            if (this.flowKey || isEmpty(next) || next === ",") {
              this.flowKey = false;
              yield* this.pushCount(1);
              yield* this.pushSpaces(true);
              return "flow";
            }
          }
          // fallthrough
          default:
            this.flowKey = false;
            return yield* this.parsePlainScalar();
        }
      }
      *parseQuotedScalar() {
        const quote = this.charAt(0);
        let end = this.buffer.indexOf(quote, this.pos + 1);
        if (quote === "'") {
          while (end !== -1 && this.buffer[end + 1] === "'")
            end = this.buffer.indexOf("'", end + 2);
        } else {
          while (end !== -1) {
            let n = 0;
            while (this.buffer[end - 1 - n] === "\\")
              n += 1;
            if (n % 2 === 0)
              break;
            end = this.buffer.indexOf('"', end + 1);
          }
        }
        const qb = this.buffer.substring(0, end);
        let nl = qb.indexOf("\n", this.pos);
        if (nl !== -1) {
          while (nl !== -1) {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = qb.indexOf("\n", cs);
          }
          if (nl !== -1) {
            end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
          }
        }
        if (end === -1) {
          if (!this.atEnd)
            return this.setNext("quoted-scalar");
          end = this.buffer.length;
        }
        yield* this.pushToIndex(end + 1, false);
        return this.flowLevel ? "flow" : "doc";
      }
      *parseBlockScalarHeader() {
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        let i = this.pos;
        while (true) {
          const ch = this.buffer[++i];
          if (ch === "+")
            this.blockScalarKeep = true;
          else if (ch > "0" && ch <= "9")
            this.blockScalarIndent = Number(ch) - 1;
          else if (ch !== "-")
            break;
        }
        return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
      }
      *parseBlockScalar() {
        let nl = this.pos - 1;
        let indent = 0;
        let ch;
        loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
          switch (ch) {
            case " ":
              indent += 1;
              break;
            case "\n":
              nl = i2;
              indent = 0;
              break;
            case "\r": {
              const next = this.buffer[i2 + 1];
              if (!next && !this.atEnd)
                return this.setNext("block-scalar");
              if (next === "\n")
                break;
            }
            // fallthrough
            default:
              break loop;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("block-scalar");
        if (indent >= this.indentNext) {
          if (this.blockScalarIndent === -1)
            this.indentNext = indent;
          else {
            this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
          }
          do {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = this.buffer.indexOf("\n", cs);
          } while (nl !== -1);
          if (nl === -1) {
            if (!this.atEnd)
              return this.setNext("block-scalar");
            nl = this.buffer.length;
          }
        }
        let i = nl + 1;
        ch = this.buffer[i];
        while (ch === " ")
          ch = this.buffer[++i];
        if (ch === "	") {
          while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
            ch = this.buffer[++i];
          nl = i - 1;
        } else if (!this.blockScalarKeep) {
          do {
            let i2 = nl - 1;
            let ch2 = this.buffer[i2];
            if (ch2 === "\r")
              ch2 = this.buffer[--i2];
            const lastChar = i2;
            while (ch2 === " ")
              ch2 = this.buffer[--i2];
            if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
              nl = i2;
            else
              break;
          } while (true);
        }
        yield cst.SCALAR;
        yield* this.pushToIndex(nl + 1, true);
        return yield* this.parseLineStart();
      }
      *parsePlainScalar() {
        const inFlow = this.flowLevel > 0;
        let end = this.pos - 1;
        let i = this.pos - 1;
        let ch;
        while (ch = this.buffer[++i]) {
          if (ch === ":") {
            const next = this.buffer[i + 1];
            if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
              break;
            end = i;
          } else if (isEmpty(ch)) {
            let next = this.buffer[i + 1];
            if (ch === "\r") {
              if (next === "\n") {
                i += 1;
                ch = "\n";
                next = this.buffer[i + 1];
              } else
                end = i;
            }
            if (next === "#" || inFlow && flowIndicatorChars.has(next))
              break;
            if (ch === "\n") {
              const cs = this.continueScalar(i + 1);
              if (cs === -1)
                break;
              i = Math.max(i, cs - 2);
            }
          } else {
            if (inFlow && flowIndicatorChars.has(ch))
              break;
            end = i;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("plain-scalar");
        yield cst.SCALAR;
        yield* this.pushToIndex(end + 1, true);
        return inFlow ? "flow" : "doc";
      }
      *pushCount(n) {
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos += n;
          return n;
        }
        return 0;
      }
      *pushToIndex(i, allowEmpty) {
        const s = this.buffer.slice(this.pos, i);
        if (s) {
          yield s;
          this.pos += s.length;
          return s.length;
        } else if (allowEmpty)
          yield "";
        return 0;
      }
      *pushIndicators() {
        let n = 0;
        loop: while (true) {
          switch (this.charAt(0)) {
            case "!":
              n += yield* this.pushTag();
              n += yield* this.pushSpaces(true);
              continue loop;
            case "&":
              n += yield* this.pushUntil(isNotAnchorChar);
              n += yield* this.pushSpaces(true);
              continue loop;
            case "-":
            // this is an error
            case "?":
            // this is an error outside flow collections
            case ":": {
              const inFlow = this.flowLevel > 0;
              const ch1 = this.charAt(1);
              if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
                if (!inFlow)
                  this.indentNext = this.indentValue + 1;
                else if (this.flowKey)
                  this.flowKey = false;
                n += yield* this.pushCount(1);
                n += yield* this.pushSpaces(true);
                continue loop;
              }
            }
          }
          break loop;
        }
        return n;
      }
      *pushTag() {
        if (this.charAt(1) === "<") {
          let i = this.pos + 2;
          let ch = this.buffer[i];
          while (!isEmpty(ch) && ch !== ">")
            ch = this.buffer[++i];
          return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
        } else {
          let i = this.pos + 1;
          let ch = this.buffer[i];
          while (ch) {
            if (tagChars.has(ch))
              ch = this.buffer[++i];
            else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
              ch = this.buffer[i += 3];
            } else
              break;
          }
          return yield* this.pushToIndex(i, false);
        }
      }
      *pushNewline() {
        const ch = this.buffer[this.pos];
        if (ch === "\n")
          return yield* this.pushCount(1);
        else if (ch === "\r" && this.charAt(1) === "\n")
          return yield* this.pushCount(2);
        else
          return 0;
      }
      *pushSpaces(allowTabs) {
        let i = this.pos - 1;
        let ch;
        do {
          ch = this.buffer[++i];
        } while (ch === " " || allowTabs && ch === "	");
        const n = i - this.pos;
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos = i;
        }
        return n;
      }
      *pushUntil(test) {
        let i = this.pos;
        let ch = this.buffer[i];
        while (!test(ch))
          ch = this.buffer[++i];
        return yield* this.pushToIndex(i, false);
      }
    };
    exports.Lexer = Lexer;
  }
});

// node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = __commonJS({
  "node_modules/yaml/dist/parse/line-counter.js"(exports) {
    "use strict";
    var LineCounter = class {
      constructor() {
        this.lineStarts = [];
        this.addNewLine = (offset) => this.lineStarts.push(offset);
        this.linePos = (offset) => {
          let low = 0;
          let high = this.lineStarts.length;
          while (low < high) {
            const mid = low + high >> 1;
            if (this.lineStarts[mid] < offset)
              low = mid + 1;
            else
              high = mid;
          }
          if (this.lineStarts[low] === offset)
            return { line: low + 1, col: 1 };
          if (low === 0)
            return { line: 0, col: offset };
          const start = this.lineStarts[low - 1];
          return { line: low, col: offset - start + 1 };
        };
      }
    };
    exports.LineCounter = LineCounter;
  }
});

// node_modules/yaml/dist/parse/parser.js
var require_parser = __commonJS({
  "node_modules/yaml/dist/parse/parser.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var cst = require_cst();
    var lexer = require_lexer();
    function includesToken(list, type) {
      for (let i = 0; i < list.length; ++i)
        if (list[i].type === type)
          return true;
      return false;
    }
    function findNonEmptyIndex(list) {
      for (let i = 0; i < list.length; ++i) {
        switch (list[i].type) {
          case "space":
          case "comment":
          case "newline":
            break;
          default:
            return i;
        }
      }
      return -1;
    }
    function isFlowToken(token) {
      switch (token?.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "flow-collection":
          return true;
        default:
          return false;
      }
    }
    function getPrevProps(parent) {
      switch (parent.type) {
        case "document":
          return parent.start;
        case "block-map": {
          const it = parent.items[parent.items.length - 1];
          return it.sep ?? it.start;
        }
        case "block-seq":
          return parent.items[parent.items.length - 1].start;
        /* istanbul ignore next should not happen */
        default:
          return [];
      }
    }
    function getFirstKeyStartProps(prev) {
      if (prev.length === 0)
        return [];
      let i = prev.length;
      loop: while (--i >= 0) {
        switch (prev[i].type) {
          case "doc-start":
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
          case "newline":
            break loop;
        }
      }
      while (prev[++i]?.type === "space") {
      }
      return prev.splice(i, prev.length);
    }
    function arrayPushArray(target, source) {
      if (source.length < 1e5)
        Array.prototype.push.apply(target, source);
      else
        for (let i = 0; i < source.length; ++i)
          target.push(source[i]);
    }
    function fixFlowSeqItems(fc) {
      if (fc.start.type === "flow-seq-start") {
        for (const it of fc.items) {
          if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
            if (it.key)
              it.value = it.key;
            delete it.key;
            if (isFlowToken(it.value)) {
              if (it.value.end)
                arrayPushArray(it.value.end, it.sep);
              else
                it.value.end = it.sep;
            } else
              arrayPushArray(it.start, it.sep);
            delete it.sep;
          }
        }
      }
    }
    var Parser = class {
      /**
       * @param onNewLine - If defined, called separately with the start position of
       *   each new line (in `parse()`, including the start of input).
       */
      constructor(onNewLine) {
        this.atNewLine = true;
        this.atScalar = false;
        this.indent = 0;
        this.offset = 0;
        this.onKeyLine = false;
        this.stack = [];
        this.source = "";
        this.type = "";
        this.lexer = new lexer.Lexer();
        this.onNewLine = onNewLine;
      }
      /**
       * Parse `source` as a YAML stream.
       * If `incomplete`, a part of the last line may be left as a buffer for the next call.
       *
       * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
       *
       * @returns A generator of tokens representing each directive, document, and other structure.
       */
      *parse(source, incomplete = false) {
        if (this.onNewLine && this.offset === 0)
          this.onNewLine(0);
        for (const lexeme of this.lexer.lex(source, incomplete))
          yield* this.next(lexeme);
        if (!incomplete)
          yield* this.end();
      }
      /**
       * Advance the parser by the `source` of one lexical token.
       */
      *next(source) {
        this.source = source;
        if (node_process.env.LOG_TOKENS)
          console.log("|", cst.prettyToken(source));
        if (this.atScalar) {
          this.atScalar = false;
          yield* this.step();
          this.offset += source.length;
          return;
        }
        const type = cst.tokenType(source);
        if (!type) {
          const message = `Not a YAML token: ${source}`;
          yield* this.pop({ type: "error", offset: this.offset, message, source });
          this.offset += source.length;
        } else if (type === "scalar") {
          this.atNewLine = false;
          this.atScalar = true;
          this.type = "scalar";
        } else {
          this.type = type;
          yield* this.step();
          switch (type) {
            case "newline":
              this.atNewLine = true;
              this.indent = 0;
              if (this.onNewLine)
                this.onNewLine(this.offset + source.length);
              break;
            case "space":
              if (this.atNewLine && source[0] === " ")
                this.indent += source.length;
              break;
            case "explicit-key-ind":
            case "map-value-ind":
            case "seq-item-ind":
              if (this.atNewLine)
                this.indent += source.length;
              break;
            case "doc-mode":
            case "flow-error-end":
              return;
            default:
              this.atNewLine = false;
          }
          this.offset += source.length;
        }
      }
      /** Call at end of input to push out any remaining constructions */
      *end() {
        while (this.stack.length > 0)
          yield* this.pop();
      }
      get sourceToken() {
        const st = {
          type: this.type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
        return st;
      }
      *step() {
        const top = this.peek(1);
        if (this.type === "doc-end" && top?.type !== "doc-end") {
          while (this.stack.length > 0)
            yield* this.pop();
          this.stack.push({
            type: "doc-end",
            offset: this.offset,
            source: this.source
          });
          return;
        }
        if (!top)
          return yield* this.stream();
        switch (top.type) {
          case "document":
            return yield* this.document(top);
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return yield* this.scalar(top);
          case "block-scalar":
            return yield* this.blockScalar(top);
          case "block-map":
            return yield* this.blockMap(top);
          case "block-seq":
            return yield* this.blockSequence(top);
          case "flow-collection":
            return yield* this.flowCollection(top);
          case "doc-end":
            return yield* this.documentEnd(top);
        }
        yield* this.pop();
      }
      peek(n) {
        return this.stack[this.stack.length - n];
      }
      *pop(error) {
        const token = error ?? this.stack.pop();
        if (!token) {
          const message = "Tried to pop an empty stack";
          yield { type: "error", offset: this.offset, source: "", message };
        } else if (this.stack.length === 0) {
          yield token;
        } else {
          const top = this.peek(1);
          if (token.type === "block-scalar") {
            token.indent = "indent" in top ? top.indent : 0;
          } else if (token.type === "flow-collection" && top.type === "document") {
            token.indent = 0;
          }
          if (token.type === "flow-collection")
            fixFlowSeqItems(token);
          switch (top.type) {
            case "document":
              top.value = token;
              break;
            case "block-scalar":
              top.props.push(token);
              break;
            case "block-map": {
              const it = top.items[top.items.length - 1];
              if (it.value) {
                top.items.push({ start: [], key: token, sep: [] });
                this.onKeyLine = true;
                return;
              } else if (it.sep) {
                it.value = token;
              } else {
                Object.assign(it, { key: token, sep: [] });
                this.onKeyLine = !it.explicitKey;
                return;
              }
              break;
            }
            case "block-seq": {
              const it = top.items[top.items.length - 1];
              if (it.value)
                top.items.push({ start: [], value: token });
              else
                it.value = token;
              break;
            }
            case "flow-collection": {
              const it = top.items[top.items.length - 1];
              if (!it || it.value)
                top.items.push({ start: [], key: token, sep: [] });
              else if (it.sep)
                it.value = token;
              else
                Object.assign(it, { key: token, sep: [] });
              return;
            }
            /* istanbul ignore next should not happen */
            default:
              yield* this.pop();
              yield* this.pop(token);
          }
          if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
            const last = token.items[token.items.length - 1];
            if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
              if (top.type === "document")
                top.end = last.start;
              else
                top.items.push({ start: last.start });
              token.items.splice(-1, 1);
            }
          }
        }
      }
      *stream() {
        switch (this.type) {
          case "directive-line":
            yield { type: "directive", offset: this.offset, source: this.source };
            return;
          case "byte-order-mark":
          case "space":
          case "comment":
          case "newline":
            yield this.sourceToken;
            return;
          case "doc-mode":
          case "doc-start": {
            const doc = {
              type: "document",
              offset: this.offset,
              start: []
            };
            if (this.type === "doc-start")
              doc.start.push(this.sourceToken);
            this.stack.push(doc);
            return;
          }
        }
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML stream`,
          source: this.source
        };
      }
      *document(doc) {
        if (doc.value)
          return yield* this.lineEnd(doc);
        switch (this.type) {
          case "doc-start": {
            if (findNonEmptyIndex(doc.start) !== -1) {
              yield* this.pop();
              yield* this.step();
            } else
              doc.start.push(this.sourceToken);
            return;
          }
          case "anchor":
          case "tag":
          case "space":
          case "comment":
          case "newline":
            doc.start.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(doc);
        if (bv)
          this.stack.push(bv);
        else {
          yield {
            type: "error",
            offset: this.offset,
            message: `Unexpected ${this.type} token in YAML document`,
            source: this.source
          };
        }
      }
      *scalar(scalar) {
        if (this.type === "map-value-ind") {
          const prev = getPrevProps(this.peek(2));
          const start = getFirstKeyStartProps(prev);
          let sep5;
          if (scalar.end) {
            sep5 = scalar.end;
            sep5.push(this.sourceToken);
            delete scalar.end;
          } else
            sep5 = [this.sourceToken];
          const map = {
            type: "block-map",
            offset: scalar.offset,
            indent: scalar.indent,
            items: [{ start, key: scalar, sep: sep5 }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map;
        } else
          yield* this.lineEnd(scalar);
      }
      *blockScalar(scalar) {
        switch (this.type) {
          case "space":
          case "comment":
          case "newline":
            scalar.props.push(this.sourceToken);
            return;
          case "scalar":
            scalar.source = this.source;
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine) {
              let nl = this.source.indexOf("\n") + 1;
              while (nl !== 0) {
                this.onNewLine(this.offset + nl);
                nl = this.source.indexOf("\n", nl) + 1;
              }
            }
            yield* this.pop();
            break;
          /* istanbul ignore next should not happen */
          default:
            yield* this.pop();
            yield* this.step();
        }
      }
      *blockMap(map) {
        const it = map.items[map.items.length - 1];
        switch (this.type) {
          case "newline":
            this.onKeyLine = false;
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "space":
          case "comment":
            if (it.value) {
              map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              if (this.atIndentedComment(it.start, map.indent)) {
                const prev = map.items[map.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  map.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
        }
        if (this.indent >= map.indent) {
          const atMapIndent = !this.onKeyLine && this.indent === map.indent;
          const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
          let start = [];
          if (atNextItem && it.sep && !it.value) {
            const nl = [];
            for (let i = 0; i < it.sep.length; ++i) {
              const st = it.sep[i];
              switch (st.type) {
                case "newline":
                  nl.push(i);
                  break;
                case "space":
                  break;
                case "comment":
                  if (st.indent > map.indent)
                    nl.length = 0;
                  break;
                default:
                  nl.length = 0;
              }
            }
            if (nl.length >= 2)
              start = it.sep.splice(nl[1]);
          }
          switch (this.type) {
            case "anchor":
            case "tag":
              if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start });
                this.onKeyLine = true;
              } else if (it.sep) {
                it.sep.push(this.sourceToken);
              } else {
                it.start.push(this.sourceToken);
              }
              return;
            case "explicit-key-ind":
              if (!it.sep && !it.explicitKey) {
                it.start.push(this.sourceToken);
                it.explicitKey = true;
              } else if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start, explicitKey: true });
              } else {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [this.sourceToken], explicitKey: true }]
                });
              }
              this.onKeyLine = true;
              return;
            case "map-value-ind":
              if (it.explicitKey) {
                if (!it.sep) {
                  if (includesToken(it.start, "newline")) {
                    Object.assign(it, { key: null, sep: [this.sourceToken] });
                  } else {
                    const start2 = getFirstKeyStartProps(it.start);
                    this.stack.push({
                      type: "block-map",
                      offset: this.offset,
                      indent: this.indent,
                      items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                    });
                  }
                } else if (it.value) {
                  map.items.push({ start: [], key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, key: null, sep: [this.sourceToken] }]
                  });
                } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                  const start2 = getFirstKeyStartProps(it.start);
                  const key = it.key;
                  const sep5 = it.sep;
                  sep5.push(this.sourceToken);
                  delete it.key;
                  delete it.sep;
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key, sep: sep5 }]
                  });
                } else if (start.length > 0) {
                  it.sep = it.sep.concat(start, this.sourceToken);
                } else {
                  it.sep.push(this.sourceToken);
                }
              } else {
                if (!it.sep) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else if (it.value || atNextItem) {
                  map.items.push({ start, key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: [], key: null, sep: [this.sourceToken] }]
                  });
                } else {
                  it.sep.push(this.sourceToken);
                }
              }
              this.onKeyLine = true;
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs22 = this.flowScalar(this.type);
              if (atNextItem || it.value) {
                map.items.push({ start, key: fs22, sep: [] });
                this.onKeyLine = true;
              } else if (it.sep) {
                this.stack.push(fs22);
              } else {
                Object.assign(it, { key: fs22, sep: [] });
                this.onKeyLine = true;
              }
              return;
            }
            default: {
              const bv = this.startBlockValue(map);
              if (bv) {
                if (bv.type === "block-seq") {
                  if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                    yield* this.pop({
                      type: "error",
                      offset: this.offset,
                      message: "Unexpected block-seq-ind on same line with key",
                      source: this.source
                    });
                    return;
                  }
                } else if (atMapIndent) {
                  map.items.push({ start });
                }
                this.stack.push(bv);
                return;
              }
            }
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *blockSequence(seq) {
        const it = seq.items[seq.items.length - 1];
        switch (this.type) {
          case "newline":
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                seq.items.push({ start: [this.sourceToken] });
            } else
              it.start.push(this.sourceToken);
            return;
          case "space":
          case "comment":
            if (it.value)
              seq.items.push({ start: [this.sourceToken] });
            else {
              if (this.atIndentedComment(it.start, seq.indent)) {
                const prev = seq.items[seq.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  seq.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
          case "anchor":
          case "tag":
            if (it.value || this.indent <= seq.indent)
              break;
            it.start.push(this.sourceToken);
            return;
          case "seq-item-ind":
            if (this.indent !== seq.indent)
              break;
            if (it.value || includesToken(it.start, "seq-item-ind"))
              seq.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
        }
        if (this.indent > seq.indent) {
          const bv = this.startBlockValue(seq);
          if (bv) {
            this.stack.push(bv);
            return;
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *flowCollection(fc) {
        const it = fc.items[fc.items.length - 1];
        if (this.type === "flow-error-end") {
          let top;
          do {
            yield* this.pop();
            top = this.peek(1);
          } while (top?.type === "flow-collection");
        } else if (fc.end.length === 0) {
          switch (this.type) {
            case "comma":
            case "explicit-key-ind":
              if (!it || it.sep)
                fc.items.push({ start: [this.sourceToken] });
              else
                it.start.push(this.sourceToken);
              return;
            case "map-value-ind":
              if (!it || it.value)
                fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              return;
            case "space":
            case "comment":
            case "newline":
            case "anchor":
            case "tag":
              if (!it || it.value)
                fc.items.push({ start: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                it.start.push(this.sourceToken);
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs22 = this.flowScalar(this.type);
              if (!it || it.value)
                fc.items.push({ start: [], key: fs22, sep: [] });
              else if (it.sep)
                this.stack.push(fs22);
              else
                Object.assign(it, { key: fs22, sep: [] });
              return;
            }
            case "flow-map-end":
            case "flow-seq-end":
              fc.end.push(this.sourceToken);
              return;
          }
          const bv = this.startBlockValue(fc);
          if (bv)
            this.stack.push(bv);
          else {
            yield* this.pop();
            yield* this.step();
          }
        } else {
          const parent = this.peek(2);
          if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
            yield* this.pop();
            yield* this.step();
          } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            fixFlowSeqItems(fc);
            const sep5 = fc.end.splice(1, fc.end.length);
            sep5.push(this.sourceToken);
            const map = {
              type: "block-map",
              offset: fc.offset,
              indent: fc.indent,
              items: [{ start, key: fc, sep: sep5 }]
            };
            this.onKeyLine = true;
            this.stack[this.stack.length - 1] = map;
          } else {
            yield* this.lineEnd(fc);
          }
        }
      }
      flowScalar(type) {
        if (this.onNewLine) {
          let nl = this.source.indexOf("\n") + 1;
          while (nl !== 0) {
            this.onNewLine(this.offset + nl);
            nl = this.source.indexOf("\n", nl) + 1;
          }
        }
        return {
          type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
      }
      startBlockValue(parent) {
        switch (this.type) {
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return this.flowScalar(this.type);
          case "block-scalar-header":
            return {
              type: "block-scalar",
              offset: this.offset,
              indent: this.indent,
              props: [this.sourceToken],
              source: ""
            };
          case "flow-map-start":
          case "flow-seq-start":
            return {
              type: "flow-collection",
              offset: this.offset,
              indent: this.indent,
              start: this.sourceToken,
              items: [],
              end: []
            };
          case "seq-item-ind":
            return {
              type: "block-seq",
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken] }]
            };
          case "explicit-key-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            start.push(this.sourceToken);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, explicitKey: true }]
            };
          }
          case "map-value-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, key: null, sep: [this.sourceToken] }]
            };
          }
        }
        return null;
      }
      atIndentedComment(start, indent) {
        if (this.type !== "comment")
          return false;
        if (this.indent <= indent)
          return false;
        return start.every((st) => st.type === "newline" || st.type === "space");
      }
      *documentEnd(docEnd) {
        if (this.type !== "doc-mode") {
          if (docEnd.end)
            docEnd.end.push(this.sourceToken);
          else
            docEnd.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
        }
      }
      *lineEnd(token) {
        switch (this.type) {
          case "comma":
          case "doc-start":
          case "doc-end":
          case "flow-seq-end":
          case "flow-map-end":
          case "map-value-ind":
            yield* this.pop();
            yield* this.step();
            break;
          case "newline":
            this.onKeyLine = false;
          // fallthrough
          case "space":
          case "comment":
          default:
            if (token.end)
              token.end.push(this.sourceToken);
            else
              token.end = [this.sourceToken];
            if (this.type === "newline")
              yield* this.pop();
        }
      }
    };
    exports.Parser = Parser;
  }
});

// node_modules/yaml/dist/public-api.js
var require_public_api = __commonJS({
  "node_modules/yaml/dist/public-api.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var errors = require_errors();
    var log = require_log();
    var identity = require_identity();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    function parseOptions(options) {
      const prettyErrors = options.prettyErrors !== false;
      const lineCounter$1 = options.lineCounter || prettyErrors && new lineCounter.LineCounter() || null;
      return { lineCounter: lineCounter$1, prettyErrors };
    }
    function parseAllDocuments(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      const docs = Array.from(composer$1.compose(parser$1.parse(source)));
      if (prettyErrors && lineCounter2)
        for (const doc of docs) {
          doc.errors.forEach(errors.prettifyError(source, lineCounter2));
          doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
        }
      if (docs.length > 0)
        return docs;
      return Object.assign([], { empty: true }, composer$1.streamInfo());
    }
    function parseDocument(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      let doc = null;
      for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
        if (!doc)
          doc = _doc;
        else if (doc.options.logLevel !== "silent") {
          doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
          break;
        }
      }
      if (prettyErrors && lineCounter2) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter2));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
      }
      return doc;
    }
    function parse3(src, reviver, options) {
      let _reviver = void 0;
      if (typeof reviver === "function") {
        _reviver = reviver;
      } else if (options === void 0 && reviver && typeof reviver === "object") {
        options = reviver;
      }
      const doc = parseDocument(src, options);
      if (!doc)
        return null;
      doc.warnings.forEach((warning) => log.warn(doc.options.logLevel, warning));
      if (doc.errors.length > 0) {
        if (doc.options.logLevel !== "silent")
          throw doc.errors[0];
        else
          doc.errors = [];
      }
      return doc.toJS(Object.assign({ reviver: _reviver }, options));
    }
    function stringify(value, replacer, options) {
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
      }
      if (typeof options === "string")
        options = options.length;
      if (typeof options === "number") {
        const indent = Math.round(options);
        options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
      }
      if (value === void 0) {
        const { keepUndefined } = options ?? replacer ?? {};
        if (!keepUndefined)
          return void 0;
      }
      if (identity.isDocument(value) && !_replacer)
        return value.toString(options);
      return new Document.Document(value, _replacer, options).toString(options);
    }
    exports.parse = parse3;
    exports.parseAllDocuments = parseAllDocuments;
    exports.parseDocument = parseDocument;
    exports.stringify = stringify;
  }
});

// node_modules/yaml/dist/index.js
var require_dist = __commonJS({
  "node_modules/yaml/dist/index.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var Schema = require_Schema();
    var errors = require_errors();
    var Alias = require_Alias();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var cst = require_cst();
    var lexer = require_lexer();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    var publicApi = require_public_api();
    var visit = require_visit();
    exports.Composer = composer.Composer;
    exports.Document = Document.Document;
    exports.Schema = Schema.Schema;
    exports.YAMLError = errors.YAMLError;
    exports.YAMLParseError = errors.YAMLParseError;
    exports.YAMLWarning = errors.YAMLWarning;
    exports.Alias = Alias.Alias;
    exports.isAlias = identity.isAlias;
    exports.isCollection = identity.isCollection;
    exports.isDocument = identity.isDocument;
    exports.isMap = identity.isMap;
    exports.isNode = identity.isNode;
    exports.isPair = identity.isPair;
    exports.isScalar = identity.isScalar;
    exports.isSeq = identity.isSeq;
    exports.Pair = Pair.Pair;
    exports.Scalar = Scalar.Scalar;
    exports.YAMLMap = YAMLMap.YAMLMap;
    exports.YAMLSeq = YAMLSeq.YAMLSeq;
    exports.CST = cst;
    exports.Lexer = lexer.Lexer;
    exports.LineCounter = lineCounter.LineCounter;
    exports.Parser = parser.Parser;
    exports.parse = publicApi.parse;
    exports.parseAllDocuments = publicApi.parseAllDocuments;
    exports.parseDocument = publicApi.parseDocument;
    exports.stringify = publicApi.stringify;
    exports.visit = visit.visit;
    exports.visitAsync = visit.visitAsync;
  }
});

// src/scripts/install.ts
import { spawn, spawnSync as spawnSync2 } from "node:child_process";
import * as crypto3 from "node:crypto";
import * as fs21 from "node:fs";
import * as os8 from "node:os";
import * as path18 from "node:path";
import process3 from "node:process";
import { fileURLToPath as fileURLToPath5, pathToFileURL as pathToFileURL2 } from "node:url";

// src/scripts/_lib/json_pointers.ts
import { createHash } from "node:crypto";
var ArrayIndexPointerError = class extends Error {
  pointer;
  segment;
  constructor(pointer, segment) {
    super(
      `json_pointer '${pointer}' targets array index '${segment}'; pointers MUST target named object keys only (see road-to-multi-package-coexistence.md \xA7 P1.5)`
    );
    this.name = "ArrayIndexPointerError";
    this.pointer = pointer;
    this.segment = segment;
  }
};
function _escape_segment(key) {
  return key.replace(/~/g, "~0").replace(/\//g, "~1");
}
function validate_pointer(pointer) {
  if (pointer === "") return;
  if (!pointer.startsWith("/")) {
    throw new Error(
      `json_pointer '${pointer}' must start with '/' (RFC 6901)`
    );
  }
  const segments = pointer.split("/").slice(1);
  for (const seg of segments) {
    if (/^[0-9]+$/.test(seg) && (seg === "0" || !seg.startsWith("0"))) {
      throw new ArrayIndexPointerError(pointer, seg);
    }
  }
}
function _cmp_code_points(a, b) {
  const ai = [...a];
  const bi = [...b];
  const n = Math.min(ai.length, bi.length);
  for (let i = 0; i < n; i += 1) {
    const ca = ai[i].codePointAt(0);
    const cb = bi[i].codePointAt(0);
    if (ca !== cb) return ca - cb;
  }
  return ai.length - bi.length;
}
function _py_json_string(s) {
  let out = '"';
  for (let i = 0; i < s.length; i += 1) {
    const code = s.charCodeAt(i);
    const ch = s[i];
    if (ch === '"') out += '\\"';
    else if (ch === "\\") out += "\\\\";
    else if (ch === "\b") out += "\\b";
    else if (ch === "\f") out += "\\f";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "	") out += "\\t";
    else if (code >= 32 && code <= 126) out += ch;
    else out += `\\u${code.toString(16).padStart(4, "0")}`;
  }
  return out + '"';
}
function _py_json_number(n) {
  if (!Number.isFinite(n)) {
    if (Number.isNaN(n)) return "NaN";
    return n > 0 ? "Infinity" : "-Infinity";
  }
  return String(n);
}
function _canonical_json(value) {
  if (value === null) return "null";
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      return _py_json_number(value);
    case "string":
      return _py_json_string(value);
    case "object":
      break;
    default:
      throw new TypeError(
        `Object of type ${typeof value} is not JSON serializable`
      );
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => _canonical_json(v)).join(",")}]`;
  }
  const obj = value;
  const keys = Object.keys(obj).sort(_cmp_code_points);
  const parts = keys.map(
    (k) => `${_py_json_string(k)}:${_canonical_json(obj[k])}`
  );
  return `{${parts.join(",")}}`;
}
function value_hash(value) {
  const payload = _canonical_json(value);
  return createHash("sha256").update(payload, "utf-8").digest("hex");
}
function _is_plain_object(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function collect_pointers(overlay, options = {}) {
  const prefix = options.prefix ?? "";
  const include_arrays = options.include_arrays ?? true;
  const entries = [];
  for (const [key, value] of Object.entries(overlay)) {
    const pointer = `${prefix}/${_escape_segment(String(key))}`;
    if (_is_plain_object(value)) {
      if (Object.keys(value).length === 0) {
        entries.push({ json_pointer: pointer, value_hash: null });
      } else {
        entries.push(
          ...collect_pointers(value, { prefix: pointer, include_arrays })
        );
      }
    } else if (Array.isArray(value)) {
      entries.push({
        json_pointer: pointer,
        value_hash: include_arrays ? value_hash(value) : null
      });
    } else {
      entries.push({ json_pointer: pointer, value_hash: null });
    }
  }
  for (const entry of entries) {
    validate_pointer(entry.json_pointer);
  }
  return entries;
}
function build_merge_entries(file_label, overlay) {
  const pointers = collect_pointers(overlay);
  return pointers.map((entry) => ({
    file: file_label,
    json_pointer: entry.json_pointer,
    value_hash: entry.value_hash
  }));
}

// src/scripts/_lib/claude_builtin_names.ts
var _CURRENT = [
  "add-dir",
  "advisor",
  "agents",
  "autofix-pr",
  "background",
  "batch",
  "branch",
  "btw",
  "cd",
  "chrome",
  "claude-api",
  "clear",
  "code-review",
  "color",
  "compact",
  "config",
  "context",
  "copy",
  "cost",
  "dataviz",
  "debug",
  "deep-research",
  "design-login",
  "design-sync",
  "desktop",
  "diff",
  "doctor",
  "effort",
  "exit",
  "export",
  "fast",
  "feedback",
  "fewer-permission-prompts",
  "focus",
  "fork",
  "goal",
  "heapdump",
  "help",
  "hooks",
  "ide",
  "init",
  "insights",
  "install-github-app",
  "install-slack-app",
  "keybindings",
  "login",
  "logout",
  "loop",
  "mcp",
  "memory",
  "mobile",
  "model",
  "passes",
  "permissions",
  "plan",
  "plugin",
  "powerup",
  "pr-comments",
  "privacy-settings",
  "radio",
  "recap",
  "release-notes",
  "reload-plugins",
  "reload-skills",
  "remote-control",
  "remote-env",
  "rename",
  "resume",
  "review",
  "rewind",
  "run",
  "run-skill-generator",
  "sandbox",
  "schedule",
  "scroll-speed",
  "security-review",
  "setup-bedrock",
  "setup-vertex",
  "simplify",
  "skills",
  "stats",
  "status",
  "statusline",
  "stickers",
  "teleport",
  "thinking",
  "trust",
  "upgrade",
  "usage",
  "verify",
  "vim",
  "web",
  "whats-new",
  "workflow",
  "workflows",
  "worktree"
];
var _LEGACY = [
  "bashes",
  "bug",
  "migrate-installer",
  "output-style",
  "terminal-setup",
  "theme",
  "todos"
];
var CLAUDE_CODE_BUILTIN_NAMES = /* @__PURE__ */ new Set([
  ..._CURRENT,
  ..._LEGACY
]);
function is_claude_builtin_name(slug) {
  return CLAUDE_CODE_BUILTIN_NAMES.has(slug.toLowerCase());
}

// src/scripts/_lib/installed_lock.ts
import { randomBytes } from "node:crypto";
import * as fs2 from "node:fs";
import * as os2 from "node:os";
import * as path2 from "node:path";
import { fileURLToPath } from "node:url";

// src/scripts/_lib/user_global_paths.ts
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
var _PARTIAL_SUFFIX = ".event4u-partial-";
var EVENT4U_HOME_ENV = "EVENT4U_CONFIG_HOME";
var DEFAULT_EVENT4U_ROOT_RELATIVE = path.join(".event4u", "agent-config");
var LEGACY_XDG_ROOT_RELATIVE = path.join(".config", "agent-config");
function expanduser(p) {
  if (p === "~") {
    return os.homedir();
  }
  if (p.startsWith("~/") || process.platform === "win32" && p.startsWith("~\\")) {
    return path.join(os.homedir(), p.slice(2));
  }
  return p;
}
function is_absolute_like_python(p) {
  if (process.platform === "win32") {
    return /^[a-zA-Z]:[\\/]/.test(p) || /^([\\/]{2})[^\\/]+[\\/][^\\/]+/.test(p);
  }
  return p.startsWith("/");
}
function event4u_root(env) {
  const env_map = env ?? process.env;
  const override = env_map[EVENT4U_HOME_ENV];
  if (override) {
    return expanduser(override);
  }
  return path.join(os.homedir(), DEFAULT_EVENT4U_ROOT_RELATIVE);
}
function legacy_xdg_root() {
  return path.join(os.homedir(), LEGACY_XDG_ROOT_RELATIVE);
}
function resolve_with_fallback(relative_name, options = {}) {
  if (is_absolute_like_python(relative_name)) {
    throw new Error(
      `resolve_with_fallback expects a relative path, got '${relative_name}'`
    );
  }
  const new_path = path.join(event4u_root(options.env ?? null), relative_name);
  if (fs.existsSync(new_path)) {
    return new_path;
  }
  const legacy_path = path.join(legacy_xdg_root(), relative_name);
  if (fs.existsSync(legacy_path)) {
    return legacy_path;
  }
  return null;
}
function write_target(relative_name, options = {}) {
  if (is_absolute_like_python(relative_name)) {
    throw new Error(`write_target expects a relative path, got '${relative_name}'`);
  }
  return path.join(event4u_root(options.env ?? null), relative_name);
}
var MIGRATION_BREADCRUMB_NAME = "MIGRATED.md";
var _BREADCRUMB_TEMPLATE = `# Migrated to \`~/.event4u/agent-config/\`

This directory (\`~/.config/agent-config/\`) is the **legacy** location
for \`event4u/agent-config\` user-global state. As of v2.4 the canonical
location is \`~/.event4u/agent-config/\`.

The migration shim has already copied your settings, keys, lockfiles,
and overrides into the new namespace. File modes (0600 on keys) were
preserved. Loaders prefer the new path but still read from this tree
as a fallback, so removing it is safe **once you've confirmed** the
new location is working.

## To clean up

\`\`\`bash
rm -rf ~/.config/agent-config
\`\`\`

## Why the move

\`~/.config/\` is a generic XDG-shaped directory shared by many tools.
\`~/.event4u/agent-config/\` is vendor-namespaced and avoids collisions
with unrelated CLIs. See
\`agents/roadmaps/road-to-event4u-namespace-and-claude-desktop.md\` for
the full rationale.
`;
function migrate_legacy_namespace(options = {}) {
  const legacy_root = options.legacy_root_override ?? legacy_xdg_root();
  const new_root = event4u_root(options.env ?? null);
  let legacy_stat;
  try {
    legacy_stat = fs.statSync(legacy_root);
  } catch {
    return false;
  }
  if (!legacy_stat.isDirectory()) {
    return false;
  }
  const legacy_entries = fs.readdirSync(legacy_root).filter((name) => name !== MIGRATION_BREADCRUMB_NAME);
  if (legacy_entries.length === 0) {
    return false;
  }
  const new_has_content = fs.existsSync(new_root) && fs.readdirSync(new_root).some((name) => !_is_partial_name(name));
  if (new_has_content) {
    _ensure_breadcrumb(legacy_root);
    return false;
  }
  fs.mkdirSync(new_root, { recursive: true });
  _purge_partial_entries(new_root);
  for (const name of legacy_entries) {
    const entry = path.join(legacy_root, name);
    const target = path.join(new_root, name);
    if (fs.existsSync(target)) {
      continue;
    }
    const staging = path.join(new_root, `${name}${_PARTIAL_SUFFIX}${process.pid}`);
    if (fs.existsSync(staging)) {
      _remove_path(staging);
    }
    if (fs.statSync(entry).isDirectory()) {
      fs.cpSync(entry, staging, { recursive: true, preserveTimestamps: true });
    } else {
      fs.copyFileSync(entry, staging);
      const src_stat = fs.statSync(entry);
      fs.chmodSync(staging, src_stat.mode & 4095);
      fs.utimesSync(staging, src_stat.atime, src_stat.mtime);
    }
    fs.renameSync(staging, target);
  }
  _ensure_breadcrumb(legacy_root);
  return true;
}
function _is_partial_name(name) {
  return name.includes(_PARTIAL_SUFFIX);
}
function _purge_partial_entries(new_root) {
  for (const name of fs.readdirSync(new_root)) {
    if (_is_partial_name(name)) {
      _remove_path(path.join(new_root, name));
    }
  }
}
function _remove_path(p) {
  let st = null;
  try {
    st = fs.lstatSync(p);
  } catch {
    return;
  }
  if (st.isDirectory() && !st.isSymbolicLink()) {
    fs.rmSync(p, { recursive: true });
  } else {
    fs.rmSync(p, { force: true });
  }
}
function _ensure_breadcrumb(legacy_root) {
  const breadcrumb = path.join(legacy_root, MIGRATION_BREADCRUMB_NAME);
  if (fs.existsSync(breadcrumb)) {
    return;
  }
  fs.writeFileSync(breadcrumb, _BREADCRUMB_TEMPLATE, "utf-8");
}

// src/scripts/_lib/install_layout.ts
var PRE_FREEZE_LAYOUT_VERSION = 0;
var INSTALL_LAYOUT_VERSION = 1;
function _pyInt(value) {
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^[+-]?\d+(?:_\d+)*$/.test(trimmed)) {
      return null;
    }
    return Number.parseInt(trimmed.replace(/_/g, ""), 10);
  }
  return null;
}
function coerce_layout_version(value) {
  if (value === null || value === void 0) {
    return PRE_FREEZE_LAYOUT_VERSION;
  }
  const parsed = _pyInt(value);
  if (parsed === null) {
    return PRE_FREEZE_LAYOUT_VERSION;
  }
  return parsed;
}
function needs_migration(recorded) {
  return coerce_layout_version(recorded) < INSTALL_LAYOUT_VERSION;
}

// src/scripts/_lib/installed_lock.ts
var LOCKFILE_ENV = "AGENT_CONFIG_INSTALLED_LOCK";
var SCHEMA_VERSION = 1;
function _default_lockfile() {
  return write_target("installed.lock");
}
var DEFAULT_LOCKFILE = _default_lockfile();
var _VERSION_RE = /^\s*agent_config_version\s*:\s*"?([^"\s]+)"?\s*$/;
var _SCHEMA_RE = /^\s*schema_version\s*:\s*(\d+)\s*$/;
var _LAYOUT_RE = /^\s*install_layout_version\s*:\s*(\d+)\s*$/;
var _INSTALLED_AT_RE = /^\s*installed_at\s*:\s*"?([^"\s]+)"?\s*$/;
var _FINGERPRINT_RE = /^\s*host_layer_fingerprint\s*:\s*"?([0-9a-f]{64})"?\s*$/;
var _TOOL_RE = /^\s*-\s*([A-Za-z0-9_\-.]+)\s*$/;
function expanduser2(p) {
  if (p === "~") {
    return os2.homedir();
  }
  if (p.startsWith("~/") || process.platform === "win32" && p.startsWith("~\\")) {
    return path2.join(os2.homedir(), p.slice(2));
  }
  return p;
}
function lockfile_path(env) {
  const env_map = env ?? process.env;
  const override = env_map[LOCKFILE_ENV];
  if (override) {
    return expanduser2(override);
  }
  const resolved = resolve_with_fallback("installed.lock", { env: env ?? null });
  if (resolved !== null) {
    return resolved;
  }
  return write_target("installed.lock", { env: env ?? null });
}
function lockfile_write_path(env) {
  const env_map = env ?? process.env;
  const override = env_map[LOCKFILE_ENV];
  if (override) {
    return expanduser2(override);
  }
  return write_target("installed.lock", { env: env ?? null });
}
function read_lockfile(path19) {
  const target = path19 ?? lockfile_path();
  let text;
  try {
    text = fs2.readFileSync(target, { encoding: "utf-8" });
  } catch {
    return null;
  }
  const data = { tools: [] };
  let in_tools = false;
  for (const raw_line of splitlines(text)) {
    const schema_m = _SCHEMA_RE.exec(raw_line);
    if (schema_m) {
      data.schema_version = Number.parseInt(schema_m[1], 10);
      in_tools = false;
      continue;
    }
    const layout_m = _LAYOUT_RE.exec(raw_line);
    if (layout_m) {
      data.install_layout_version = Number.parseInt(layout_m[1], 10);
      in_tools = false;
      continue;
    }
    const version_m = _VERSION_RE.exec(raw_line);
    if (version_m) {
      data.agent_config_version = version_m[1];
      in_tools = false;
      continue;
    }
    const installed_m = _INSTALLED_AT_RE.exec(raw_line);
    if (installed_m) {
      data.installed_at = installed_m[1];
      in_tools = false;
      continue;
    }
    const fp_m = _FINGERPRINT_RE.exec(raw_line);
    if (fp_m) {
      data.host_layer_fingerprint = fp_m[1];
      in_tools = false;
      continue;
    }
    if (raw_line.trim().startsWith("tools:")) {
      in_tools = true;
      continue;
    }
    if (in_tools) {
      const m = _TOOL_RE.exec(raw_line);
      if (m) {
        data.tools.push(m[1]);
      } else if (raw_line.trim() && !(raw_line.startsWith(" ") || raw_line.startsWith("	") || raw_line.startsWith("-"))) {
        in_tools = false;
      }
    }
  }
  return data;
}
function splitlines(text) {
  const parts = text.split("\n");
  if (parts.length > 0 && parts[parts.length - 1] === "") {
    parts.pop();
  }
  return parts;
}
function _render(version, tools, installed_at, fingerprint) {
  const lines = [
    `schema_version: ${SCHEMA_VERSION}`,
    `install_layout_version: ${INSTALL_LAYOUT_VERSION}`,
    `agent_config_version: "${version}"`,
    `installed_at: "${installed_at}"`
  ];
  if (fingerprint) {
    lines.push(`host_layer_fingerprint: "${fingerprint}"`);
  }
  lines.push("tools:");
  for (const tool of tools) {
    lines.push(`  - ${tool}`);
  }
  return lines.join("\n") + "\n";
}
function write_lockfile(version, tools, options = {}) {
  const target = options.path ?? lockfile_path();
  fs2.mkdirSync(path2.dirname(target), { recursive: true });
  const stamp = strftime_iso_z(options.now ?? /* @__PURE__ */ new Date());
  const rendered = _render(
    version,
    sorted_unique(tools),
    stamp,
    options.host_layer_fingerprint ?? null
  );
  const parent = path2.dirname(target);
  const { fd, tmp_name } = mkstemp(parent, ".installed.lock.");
  try {
    fs2.writeFileSync(fd, rendered, { encoding: "utf-8" });
    fs2.closeSync(fd);
    fs2.renameSync(tmp_name, target);
  } catch (err) {
    try {
      fs2.closeSync(fd);
    } catch {
    }
    try {
      fs2.unlinkSync(tmp_name);
    } catch {
    }
    throw err;
  }
  return target;
}
function _parse_installed_at(stamp) {
  if (!stamp) {
    return null;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/.exec(stamp);
  if (!m) {
    return null;
  }
  const [, y, mo, d, h, mi, s] = m;
  const ms = Date.UTC(
    Number.parseInt(y, 10),
    Number.parseInt(mo, 10) - 1,
    Number.parseInt(d, 10),
    Number.parseInt(h, 10),
    Number.parseInt(mi, 10),
    Number.parseInt(s, 10)
  );
  const parsed = new Date(ms);
  if (parsed.getUTCFullYear() !== Number.parseInt(y, 10) || parsed.getUTCMonth() !== Number.parseInt(mo, 10) - 1 || parsed.getUTCDate() !== Number.parseInt(d, 10) || parsed.getUTCHours() !== Number.parseInt(h, 10) || parsed.getUTCMinutes() !== Number.parseInt(mi, 10) || parsed.getUTCSeconds() !== Number.parseInt(s, 10)) {
    return null;
  }
  return parsed;
}
function migrate_layout(options = {}) {
  const target = options.path ?? lockfile_write_path();
  const existing = read_lockfile(target);
  if (existing === null) {
    return null;
  }
  const from_v = coerce_layout_version(existing.install_layout_version);
  if (!needs_migration(existing.install_layout_version)) {
    return { from: from_v, to: from_v, changed: [] };
  }
  const version = existing.agent_config_version || current_package_version();
  const tools = [...existing.tools ?? []];
  const when = options.now ?? _parse_installed_at(existing.installed_at);
  write_lockfile(version, tools, {
    path: target,
    now: when,
    host_layer_fingerprint: existing.host_layer_fingerprint ?? null
  });
  return {
    from: from_v,
    to: INSTALL_LAYOUT_VERSION,
    changed: [`install_layout_version ${from_v} \u2192 ${INSTALL_LAYOUT_VERSION}`]
  };
}
function sorted_unique(tools) {
  return [...new Set(tools)].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
}
function strftime_iso_z(now) {
  return now.toISOString().replace(/\.\d{3}Z$/, "Z");
}
function mkstemp(dir, prefix) {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const tmp_name = path2.join(dir, `${prefix}${randomBytes(6).toString("hex")}`);
    try {
      const fd = fs2.openSync(tmp_name, "wx", 384);
      return { fd, tmp_name };
    } catch (err) {
      if (err.code === "EEXIST") {
        continue;
      }
      throw err;
    }
  }
  throw new Error("mkstemp: could not create a unique temp file");
}
function check_version(installed_version, options = {}) {
  const existing = read_lockfile(options.path ?? null);
  if (existing === null) {
    return [true, null];
  }
  const recorded = existing.agent_config_version;
  if (!recorded) {
    return [true, null];
  }
  return [recorded === installed_version, recorded];
}
var _SEMVER_RE = /^\s*v?(\d+)\.(\d+)\.(\d+)/;
function _parse_semver(version) {
  const match = _SEMVER_RE.exec(version);
  if (!match) {
    return null;
  }
  return [Number.parseInt(match[1], 10), Number.parseInt(match[2], 10), Number.parseInt(match[3], 10)];
}
function classify_mismatch(installed_version, recorded) {
  if (recorded === null) {
    return "none";
  }
  if (recorded === installed_version) {
    return "match";
  }
  const rec = _parse_semver(recorded);
  const inst = _parse_semver(installed_version);
  if (rec === null || inst === null) {
    return "unparseable";
  }
  if (tuple_lt(rec, inst)) {
    return "upgrade";
  }
  return "downgrade";
}
function tuple_lt(a, b) {
  for (let i = 0; i < a.length; i += 1) {
    const av = a[i];
    const bv = b[i];
    if (av < bv) return true;
    if (av > bv) return false;
  }
  return false;
}
function _read_package_version(dir) {
  try {
    const data = JSON.parse(fs2.readFileSync(path2.join(dir, "package.json"), { encoding: "utf-8" }));
    const version = data.version;
    if (typeof version === "string" && version.trim()) {
      return version.trim();
    }
  } catch {
  }
  return null;
}
function _find_package_version_upward(start_dir) {
  let dir = start_dir;
  for (; ; ) {
    const found = _read_package_version(dir);
    if (found !== null) {
      return found;
    }
    const parent = path2.dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}
function current_package_version(repo_root) {
  if (repo_root != null) {
    return _read_package_version(repo_root) ?? "0.0.0";
  }
  const here = path2.dirname(fileURLToPath(import.meta.url));
  return _find_package_version_upward(here) ?? "0.0.0";
}

// src/scripts/_lib/scoped_projection.ts
import * as fs4 from "node:fs";
import { createRequire } from "node:module";
import * as path4 from "node:path";

// src/scripts/_lib/surface_tiers.ts
import * as fs3 from "node:fs";
import * as path3 from "node:path";
var _LAB_FALLBACK = /* @__PURE__ */ new Set(["ai-video", "ai-image", "fun"]);
function load_lab_pack_ids(repo_root) {
  const vocab = path3.join(repo_root, "src", "config", "discovery", "packs.yml");
  const ids = /* @__PURE__ */ new Set();
  try {
    const YAML3 = require_dist();
    const data = YAML3.parse(fs3.readFileSync(vocab, "utf-8"), { version: "1.1" });
    for (const entry of data ?? []) {
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        const rec = entry;
        if (rec["surface_tier"] === "lab") {
          const pid = rec["id"];
          if (typeof pid === "string") {
            ids.add(pid);
          }
        }
      }
    }
  } catch {
    return new Set(_LAB_FALLBACK);
  }
  return ids.size > 0 ? ids : new Set(_LAB_FALLBACK);
}
function frontmatter_packs(md_path) {
  let text;
  try {
    text = fs3.readFileSync(md_path, "utf-8");
  } catch {
    return /* @__PURE__ */ new Set();
  }
  if (!text.startsWith("---")) {
    return /* @__PURE__ */ new Set();
  }
  const end = text.indexOf("\n---", 3);
  const block = end !== -1 ? text.slice(3, end) : text.slice(3);
  const packs = /* @__PURE__ */ new Set();
  let in_packs_list = false;
  for (const raw of block.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    const stripped = line.trim();
    if (in_packs_list) {
      if (stripped.startsWith("- ")) {
        packs.add(_strip_quotes(stripped.slice(2).trim()));
        continue;
      }
      in_packs_list = false;
    }
    if (stripped.startsWith("pack:")) {
      const val = _strip_quotes(stripped.split(":").slice(1).join(":").trim());
      if (val) {
        packs.add(val);
      }
    } else if (stripped.startsWith("packs:")) {
      const inline = stripped.split(":").slice(1).join(":").trim();
      if (inline.startsWith("[") && inline.endsWith("]")) {
        for (const raw_item of inline.slice(1, -1).split(",")) {
          const item = _strip_quotes(raw_item.trim());
          if (item) {
            packs.add(item);
          }
        }
      } else {
        in_packs_list = true;
      }
    }
  }
  return packs;
}
function is_lab_artefact(md_path, lab_ids) {
  for (const p of frontmatter_packs(md_path)) {
    if (lab_ids.has(p)) {
      return true;
    }
  }
  return false;
}
function _strip_quotes(s) {
  let out = s;
  while (out.length > 0 && (out[0] === "'" || out[0] === '"')) {
    out = out.slice(1);
  }
  while (out.length > 0 && (out[out.length - 1] === "'" || out[out.length - 1] === '"')) {
    out = out.slice(0, -1);
  }
  return out;
}

// src/scripts/_lib/scoped_projection.ts
var _require = createRequire(import.meta.url);
var SCOPED_ACTIVE_WORKSPACES = /* @__PURE__ */ new Set([
  "engineering",
  "agent-config-maintainer"
]);
function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function yamlSafeLoad(text) {
  let YAML3;
  try {
    YAML3 = _require("yaml");
  } catch {
    return null;
  }
  try {
    return YAML3.parse(text, { version: "1.1" }) ?? null;
  } catch {
    return null;
  }
}
var PACKS_YML_REL = path4.join("src", "config", "discovery", "packs.yml");
function load_packs_registry(package_root) {
  const vocab_path = path4.join(package_root, PACKS_YML_REL);
  const data = yamlSafeLoad(fs4.readFileSync(vocab_path, "utf-8"));
  if (!Array.isArray(data)) {
    throw new Error(`packs.yml did not parse to a list: ${vocab_path}`);
  }
  const out = [];
  for (const entry of data) {
    if (!isPlainObject(entry)) continue;
    const id = entry["id"];
    if (typeof id !== "string" || id === "") continue;
    const workspaces_raw = entry["workspaces"];
    const workspaces = Array.isArray(workspaces_raw) ? workspaces_raw.filter((w) => typeof w === "string") : [];
    const requires_raw = entry["requires"] ?? entry["requires_hint"];
    const requires = Array.isArray(requires_raw) ? requires_raw.filter((r) => typeof r === "string") : [];
    out.push({ id, workspaces, requires });
  }
  return out;
}
function compute_active_pack_ids(packs, runtime_active_packs) {
  const by_id = /* @__PURE__ */ new Map();
  for (const p of packs) by_id.set(p.id, p);
  const active = /* @__PURE__ */ new Set();
  for (const p of packs) {
    if (p.workspaces.some((w) => SCOPED_ACTIVE_WORKSPACES.has(w))) {
      active.add(p.id);
    }
  }
  for (const id of runtime_active_packs) {
    active.add(id);
  }
  let frontier = [...active];
  while (frontier.length > 0) {
    const next = [];
    for (const id of frontier) {
      const rec = by_id.get(id);
      if (rec === void 0) continue;
      for (const dep of rec.requires) {
        if (!active.has(dep)) {
          active.add(dep);
          next.push(dep);
        }
      }
    }
    frontier = next;
  }
  return active;
}
function is_pruned_under_scoped(md_path, active_ids) {
  const packs = frontmatter_packs(md_path);
  if (packs.size === 0) return false;
  for (const id of packs) {
    if (active_ids.has(id)) return false;
  }
  return true;
}
var RULE_PACKS_AUTO = "auto";
function resolve_rule_pack_scope(raw, package_root, runtime_active_packs = []) {
  const is_auto = raw === RULE_PACKS_AUTO || Array.isArray(raw) && raw.length === 1 && raw[0] === RULE_PACKS_AUTO;
  if (is_auto) {
    try {
      return [
        ...compute_active_pack_ids(load_packs_registry(package_root), runtime_active_packs)
      ].sort();
    } catch {
      return null;
    }
  }
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((v) => String(v));
  }
  return null;
}

// src/scripts/_lib/global_deploy_inventory.ts
import { randomBytes as randomBytes2 } from "node:crypto";
import * as fs5 from "node:fs";
import * as os3 from "node:os";
import * as path5 from "node:path";
var SCHEMA_VERSION2 = 1;
var INVENTORY_BASENAME = "deployed-files.json";
var INVENTORY_ENV = "AGENT_CONFIG_DEPLOY_INVENTORY";
function expanduser3(p) {
  if (p === "~") {
    return os3.homedir();
  }
  if (p.startsWith("~/") || process.platform === "win32" && p.startsWith("~\\")) {
    return path5.join(os3.homedir(), p.slice(2));
  }
  return p;
}
function resolve_path(p) {
  try {
    return fs5.realpathSync(p);
  } catch {
    const abs = path5.resolve(p);
    const parts = abs.split(path5.sep);
    for (let i = parts.length; i > 0; i -= 1) {
      const prefix = parts.slice(0, i).join(path5.sep) || path5.sep;
      try {
        const real = fs5.realpathSync(prefix);
        const rest = parts.slice(i);
        return rest.length > 0 ? path5.join(real, ...rest) : real;
      } catch {
        continue;
      }
    }
    return abs;
  }
}
function path_exists(p) {
  try {
    fs5.statSync(p);
    return true;
  } catch {
    return false;
  }
}
function inventory_path(env) {
  const env_map = env ?? process.env;
  const override = env_map[INVENTORY_ENV];
  if (override) {
    return expanduser3(override);
  }
  return write_target(INVENTORY_BASENAME, { env: env ?? null });
}
function load_inventory(p) {
  const target = p ?? inventory_path();
  let data;
  try {
    data = JSON.parse(fs5.readFileSync(target, { encoding: "utf-8" }));
  } catch {
    return { schema_version: SCHEMA_VERSION2, tools: {} };
  }
  if (typeof data !== "object" || data === null || Array.isArray(data) || typeof data["tools"] !== "object" || data["tools"] === null || Array.isArray(data["tools"])) {
    return { schema_version: SCHEMA_VERSION2, tools: {} };
  }
  return data;
}
function save_inventory(data, p) {
  const target = p ?? inventory_path();
  fs5.mkdirSync(path5.dirname(target), { recursive: true });
  const payload = json_dumps_sorted(data, 2) + "\n";
  const parent = path5.dirname(target);
  let fd = null;
  let tmp_name = "";
  for (let attempt = 0; attempt < 32; attempt += 1) {
    tmp_name = path5.join(parent, `${path5.basename(target)}.${randomBytes2(6).toString("hex")}`);
    try {
      fd = fs5.openSync(tmp_name, "wx", 384);
      break;
    } catch (err) {
      if (err.code === "EEXIST") {
        continue;
      }
      throw err;
    }
  }
  if (fd === null) {
    throw new Error("save_inventory: could not create a unique temp file");
  }
  try {
    fs5.writeFileSync(fd, payload, { encoding: "utf-8" });
    fs5.closeSync(fd);
    fs5.renameSync(tmp_name, target);
  } catch (err) {
    try {
      fs5.closeSync(fd);
    } catch {
    }
    try {
      fs5.unlinkSync(tmp_name);
    } catch {
    }
    throw err;
  }
  return target;
}
function json_dumps_sorted(value, indent) {
  return render_json(value, indent, 0);
}
function render_json(value, indent, depth) {
  if (value === null) {
    return "null";
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return json_string_ascii(value);
  }
  const pad = " ".repeat(indent * (depth + 1));
  const close_pad = " ".repeat(indent * depth);
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }
    const items = value.map((v) => pad + render_json(v, indent, depth + 1));
    return "[\n" + items.join(",\n") + "\n" + close_pad + "]";
  }
  if (typeof value === "object") {
    const obj = value;
    const keys = Object.keys(obj).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
    if (keys.length === 0) {
      return "{}";
    }
    const items = keys.map(
      (k) => pad + json_string_ascii(k) + ": " + render_json(obj[k], indent, depth + 1)
    );
    return "{\n" + items.join(",\n") + "\n" + close_pad + "}";
  }
  return "null";
}
function json_string_ascii(s) {
  const base = JSON.stringify(s);
  let out = "";
  for (let i = 0; i < base.length; i += 1) {
    const code = base.charCodeAt(i);
    if (code > 126) {
      out += "\\u" + code.toString(16).padStart(4, "0");
    } else {
      out += base[i];
    }
  }
  return out;
}
function expected_deploy_files(src, dest_rel, file_filter = null) {
  const out = /* @__PURE__ */ new Set();
  let src_stat;
  try {
    src_stat = fs5.statSync(src);
  } catch {
    return out;
  }
  if (!src_stat.isDirectory()) {
    if (file_filter !== null && !file_filter(src)) {
      return out;
    }
    out.add(as_posix(dest_rel));
    return out;
  }
  const _walk = (node, prefix) => {
    const entries = fs5.readdirSync(node).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
    for (const name of entries) {
      const entry = path5.join(node, name);
      const rel = join_rel(prefix, name);
      const lst = fs5.lstatSync(entry);
      if (lst.isDirectory() && !lst.isSymbolicLink()) {
        _walk(entry, rel);
        continue;
      }
      let resolved_is_dir = false;
      try {
        resolved_is_dir = fs5.statSync(entry).isDirectory();
      } catch {
        resolved_is_dir = false;
      }
      if (resolved_is_dir) {
        _walk(fs5.realpathSync(entry), rel);
        continue;
      }
      if (file_filter !== null && !file_filter(entry)) {
        continue;
      }
      out.add(as_posix(rel));
    }
  };
  _walk(src, dest_rel);
  return out;
}
function join_rel(prefix, name) {
  return prefix ? path5.join(prefix, name) : name;
}
function as_posix(p) {
  if (p === "") {
    return ".";
  }
  return p.split(path5.sep).join("/");
}
function reap_stale(tool_id, anchor, current_files, inventory, dry_run = false) {
  const tools = inventory["tools"] ?? {};
  const entry = tools[tool_id];
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    return [];
  }
  const e = entry;
  const recorded_anchor = e["anchor"];
  const prev_files = e["files"];
  if (typeof recorded_anchor !== "string" || !Array.isArray(prev_files)) {
    return [];
  }
  const anchor_resolved = resolve_path(expanduser3(anchor));
  if (resolve_path(expanduser3(recorded_anchor)) !== anchor_resolved) {
    return [];
  }
  const deleted = [];
  const prune_candidates = /* @__PURE__ */ new Set();
  const orphans = difference(prev_files, current_files);
  for (const rel of sorted_strings(orphans)) {
    if (typeof rel !== "string" || !rel || rel.startsWith("/") || rel.startsWith("..")) {
      continue;
    }
    const target = path5.join(anchor_resolved, rel);
    try {
      relative_to(resolve_path(path5.dirname(target)), anchor_resolved);
    } catch {
      continue;
    }
    let lst = null;
    try {
      lst = fs5.lstatSync(target);
    } catch {
      lst = null;
    }
    if (lst && lst.isDirectory() && !lst.isSymbolicLink()) {
      continue;
    }
    if (dry_run) {
      if (path_exists(target) || lst !== null && lst.isSymbolicLink()) {
        deleted.push(target);
      }
      continue;
    }
    try {
      fs5.unlinkSync(target);
    } catch {
      continue;
    }
    deleted.push(target);
    prune_candidates.add(path5.dirname(target));
  }
  prune_empty_dirs(prune_candidates, anchor_resolved);
  return deleted;
}
function reap_tagged_orphans(anchor, dest_subs, current_files, package_tag, dry_run = false) {
  const anchor_resolved = resolve_path(expanduser3(anchor));
  const deleted = [];
  const prune_candidates = /* @__PURE__ */ new Set();
  const needle = `package: ${package_tag}`;
  for (const dest_sub of dest_subs) {
    const root = dest_sub ? path5.join(anchor_resolved, dest_sub) : anchor_resolved;
    let root_stat;
    try {
      root_stat = fs5.statSync(root);
    } catch {
      continue;
    }
    if (!root_stat.isDirectory()) {
      continue;
    }
    for (const md of rglob_md(root)) {
      let md_lst;
      try {
        md_lst = fs5.lstatSync(md);
      } catch {
        continue;
      }
      if (md_lst.isDirectory()) {
        continue;
      }
      const rel = relative_to_posix(md, anchor_resolved);
      if (current_files.has(rel)) {
        continue;
      }
      try {
        relative_to(resolve_path(path5.dirname(md)), anchor_resolved);
      } catch {
        continue;
      }
      let head;
      try {
        head = fs5.readFileSync(md, { encoding: "utf-8" });
      } catch {
        continue;
      }
      if (!head.startsWith("---")) {
        continue;
      }
      const end = head.indexOf("\n---", 3);
      const block = head.slice(0, end !== -1 ? end : head.length);
      const hit = splitlines2(block).some((line) => line.trim() === needle);
      if (!hit) {
        continue;
      }
      if (dry_run) {
        deleted.push(md);
        continue;
      }
      try {
        fs5.unlinkSync(md);
      } catch {
        continue;
      }
      deleted.push(md);
      prune_candidates.add(path5.dirname(md));
    }
  }
  prune_empty_dirs(prune_candidates, anchor_resolved);
  return deleted;
}
function record_deploy(tool_id, anchor, current_files, inventory) {
  if (typeof inventory["tools"] !== "object" || inventory["tools"] === null || Array.isArray(inventory["tools"])) {
    inventory["tools"] = {};
  }
  const tools = inventory["tools"];
  tools[tool_id] = {
    anchor: String(anchor),
    files: sorted_strings([...current_files])
  };
  inventory["schema_version"] = SCHEMA_VERSION2;
  return inventory;
}
function prune_empty_dirs(prune_candidates, anchor_resolved) {
  const ordered = [...prune_candidates].sort(
    (a, b) => b.split(path5.sep).length - a.split(path5.sep).length
  );
  for (const start of ordered) {
    let node = start;
    while (node !== anchor_resolved && is_ancestor(anchor_resolved, node)) {
      try {
        fs5.rmdirSync(node);
      } catch {
        break;
      }
      node = path5.dirname(node);
    }
  }
}
function is_ancestor(anchor, node) {
  const rel = path5.relative(anchor, node);
  return rel !== "" && !rel.startsWith("..") && !path5.isAbsolute(rel);
}
function relative_to(child, parent) {
  if (child === parent) {
    return "";
  }
  const rel = path5.relative(parent, child);
  if (rel.startsWith("..") || path5.isAbsolute(rel)) {
    throw new Error(`'${child}' is not in the subpath of '${parent}'`);
  }
  return rel;
}
function relative_to_posix(child, parent) {
  return path5.relative(parent, child).split(path5.sep).join("/");
}
function rglob_md(root) {
  const out = [];
  const walk = (dir) => {
    let names;
    try {
      names = fs5.readdirSync(dir).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
    } catch {
      return;
    }
    for (const name of names) {
      const full = path5.join(dir, name);
      let lst;
      try {
        lst = fs5.lstatSync(full);
      } catch {
        continue;
      }
      if (lst.isDirectory() && !lst.isSymbolicLink()) {
        walk(full);
      } else if (name.endsWith(".md")) {
        out.push(full);
      }
    }
  };
  walk(root);
  return out;
}
function difference(prev, current) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const item of prev) {
    if (typeof item === "string" && current.has(item)) {
      continue;
    }
    if (seen.has(item)) {
      continue;
    }
    seen.add(item);
    out.push(item);
  }
  return out;
}
function sorted_strings(items) {
  return items.filter((i) => typeof i === "string").sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
}
function splitlines2(text) {
  const parts = text.split("\n");
  if (parts.length > 0 && parts[parts.length - 1] === "") {
    parts.pop();
  }
  return parts;
}

// src/scripts/_lib/rule_layer_overlap.ts
import * as fs6 from "node:fs";
import * as path6 from "node:path";
var INSTALLER_PROVENANCE_KEYS = ["package", "source_path"];
function stripProvenance(text) {
  const lines = text.split("\n");
  if (lines[0]?.trim() !== "---") return text;
  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      close = i;
      break;
    }
  }
  if (close === -1) return text;
  const kept = [];
  for (let i = 0; i < lines.length; i++) {
    if (i > 0 && i < close) {
      const key = /^([A-Za-z_][A-Za-z0-9_-]*):/.exec(lines[i] ?? "")?.[1];
      if (key !== void 0 && INSTALLER_PROVENANCE_KEYS.includes(key)) continue;
    }
    kept.push(lines[i] ?? "");
  }
  return kept.join("\n");
}
function only_in(a, b) {
  return [...a.keys()].filter((k) => !b.has(k)).sort();
}
function compareLayers(global_layer, project_layer) {
  const overlap = [...global_layer.keys()].filter((k) => project_layer.has(k)).sort();
  const duplicate = [];
  const divergent = [];
  let redundant_chars = 0;
  for (const name of overlap) {
    const g = stripProvenance(global_layer.get(name) ?? "");
    const p = stripProvenance(project_layer.get(name) ?? "");
    if (g === p) {
      duplicate.push(name);
      redundant_chars += (project_layer.get(name) ?? "").length;
    } else {
      divergent.push(name);
    }
  }
  return {
    schema_version: 1,
    overlap,
    duplicate,
    divergent,
    global_only: only_in(global_layer, project_layer),
    project_only: only_in(project_layer, global_layer),
    redundant_chars
  };
}
function readRuleLayer(dir) {
  let names;
  try {
    names = fs6.readdirSync(dir);
  } catch {
    return null;
  }
  const files = /* @__PURE__ */ new Map();
  for (const name of names.filter((n) => n.endsWith(".md")).sort()) {
    try {
      files.set(name, fs6.readFileSync(path6.join(dir, name), "utf-8"));
    } catch {
      continue;
    }
  }
  return { dir, files };
}
function claudeMdExcludesGlob(dir) {
  return `${path6.resolve(dir).replace(/\/+$/, "")}/**`;
}
function mergeClaudeMdExcludes(existing, entry) {
  if (!Array.isArray(existing)) return [entry];
  if (existing.includes(entry)) return [...existing];
  return [...existing, entry];
}
function decideLayerAction(report, choice, global_dir, project_dir) {
  const refresh_required = report.divergent.length > 0;
  const skew = refresh_required ? ` ${report.divergent.length} shared rule(s) differ in body \u2014 refresh before suppressing, or obligations only the suppressed copy carries are lost.` : "";
  if (choice === "both-acknowledged") {
    return {
      write: "both",
      suppress_dir: null,
      refresh_required,
      note: `Keeping both rule layers by request: ${report.overlap.length} shared rule(s), ${report.redundant_chars} chars delivered twice per session. Nothing suppressed, nothing deleted.${skew}`
    };
  }
  const keep = choice === "global" ? global_dir : project_dir;
  const drop = choice === "global" ? project_dir : global_dir;
  return {
    write: choice,
    suppress_dir: drop,
    refresh_required,
    note: `Keeping ${choice} rule layer (${keep}); suppressing ${drop} via claudeMdExcludes \u2014 recovers ${report.redundant_chars} chars per session. No file is deleted or rewritten.${skew}`
  };
}

// src/scripts/_lib/installed_tools.ts
import * as fs8 from "node:fs";
import * as os4 from "node:os";
import * as fsPath from "node:path";

// src/scripts/_lib/fs_atomic.ts
import fs7 from "node:fs";
import path7 from "node:path";
import { randomBytes as randomBytes3 } from "node:crypto";
function _normalize_encoding(encoding) {
  const compact = encoding.toLowerCase().replace(/[-_\s]/g, "");
  const candidates = [encoding, compact];
  if (compact === "latin1" || compact === "iso88591") candidates.push("latin1");
  if (compact === "utf8") candidates.push("utf8");
  if (compact === "utf16le" || compact === "utf16") candidates.push("utf16le");
  if (compact === "usascii") candidates.push("ascii");
  for (const c of candidates) {
    if (Buffer.isEncoding(c)) return c;
  }
  throw new Error(`unknown encoding: ${encoding}`);
}
function write_atomic(p, data, options = {}) {
  const encoding = options.encoding ?? "utf-8";
  const target = path7.normalize(p);
  const parent = path7.dirname(target);
  fs7.mkdirSync(parent, { recursive: true });
  let payload;
  if (typeof data === "string") {
    payload = Buffer.from(data, _normalize_encoding(encoding));
  } else if (data instanceof Uint8Array) {
    payload = Buffer.from(data);
  } else {
    throw new TypeError(
      `write_atomic: data must be str or bytes, got ${typeof data}`
    );
  }
  let fd = null;
  let tmp_path = "";
  for (let attempt = 0; attempt < 32; attempt += 1) {
    tmp_path = path7.join(
      parent,
      `.${path7.basename(target)}.tmp.${randomBytes3(6).toString("hex")}`
    );
    try {
      fd = fs7.openSync(tmp_path, "wx", 384);
      break;
    } catch (err) {
      if (err.code === "EEXIST") continue;
      throw err;
    }
  }
  if (fd === null) {
    throw new Error("write_atomic: could not create a unique temp file");
  }
  let closed = false;
  try {
    let offset = 0;
    while (offset < payload.length) {
      offset += fs7.writeSync(fd, payload, offset, payload.length - offset);
    }
    try {
      fs7.fsyncSync(fd);
    } catch {
    }
    fs7.closeSync(fd);
    closed = true;
    fs7.renameSync(tmp_path, target);
  } catch (err) {
    if (!closed) {
      try {
        fs7.closeSync(fd);
      } catch {
      }
    }
    try {
      fs7.unlinkSync(tmp_path);
    } catch {
    }
    throw err;
  }
  _fsync_dir(parent);
  return target;
}
function _fsync_dir(directory) {
  let dir_fd;
  try {
    dir_fd = fs7.openSync(directory, fs7.constants.O_RDONLY);
  } catch {
    return;
  }
  try {
    try {
      fs7.fsyncSync(dir_fd);
    } catch {
    }
  } finally {
    fs7.closeSync(dir_fd);
  }
}

// src/scripts/_lib/installed_tools.ts
var MANIFEST_ENV = "AGENT_CONFIG_INSTALLED_TOOLS";
var DEFAULT_MANIFEST_RELATIVE = fsPath.join("agents", "installed-tools.lock");
var SCHEMA_VERSION3 = 2;
var _VALID_SCOPES = ["global", "project"];
function expanduser4(p) {
  if (p === "~") {
    return os4.homedir();
  }
  if (p.startsWith("~/") || process.platform === "win32" && p.startsWith("~\\")) {
    return fsPath.join(os4.homedir(), p.slice(2));
  }
  return p;
}
function manifest_path(project_root, env) {
  const env_map = env ?? process.env;
  const override = env_map[MANIFEST_ENV];
  if (override) {
    return expanduser4(override);
  }
  return fsPath.join(project_root, DEFAULT_MANIFEST_RELATIVE);
}
var _TOP_KEY_RE = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*"?([^"\n]*?)"?\s*$/;
var _LIST_DASH_RE = /^\s*-\s*(.+?)\s*$/;
var _INDENT_KEY_RE = /^\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*"?([^"\n]*?)"?\s*$/;
function read_manifest(path19) {
  let text;
  try {
    text = require_read_text(path19);
  } catch {
    return null;
  }
  const data = _parse_manual(text);
  return _normalise_v2_shape(data);
}
function require_read_text(path19) {
  return fs8.readFileSync(path19, { encoding: "utf-8" });
}
function _normalise_v2_shape(data) {
  if (data["tools"] === void 0 || data["tools"] === null) {
    data["tools"] = [];
  }
  if (data["deploy_roots"] === void 0 || data["deploy_roots"] === null) {
    data["deploy_roots"] = [];
  }
  const tools = data["tools"];
  for (const tool of tools) {
    if (typeof tool !== "object" || tool === null) {
      continue;
    }
    const t = tool;
    if (t["files"] === void 0 || t["files"] === null) {
      t["files"] = [];
    }
    if (t["merged_keys"] === void 0 || t["merged_keys"] === null) {
      t["merged_keys"] = [];
    }
  }
  return data;
}
function _parse_manual(text) {
  const data = { tools: [] };
  const tools = data["tools"];
  let in_tools = false;
  let current = null;
  let skip_until_outdent = false;
  for (const raw of splitlines3(text)) {
    const stripped = raw.trim();
    if (!stripped || stripped.startsWith("#")) {
      continue;
    }
    if (stripped === "tools:") {
      in_tools = true;
      current = null;
      skip_until_outdent = false;
      continue;
    }
    if (in_tools) {
      const indent = raw.length - lstrip_spaces(raw).length;
      if (skip_until_outdent && indent > 4) {
        continue;
      }
      skip_until_outdent = false;
      const m = _LIST_DASH_RE.exec(raw);
      if (m && indent === 2) {
        const first = m[1];
        current = {};
        tools.push(current);
        const inline = _TOP_KEY_RE.exec(first);
        if (inline) {
          current[inline[1]] = inline[2];
        }
        continue;
      }
      const mk = _INDENT_KEY_RE.exec(raw);
      if (mk && current !== null && indent === 4) {
        const key = mk[1];
        const val = mk[2];
        if ((key === "files" || key === "merged_keys") && !val) {
          skip_until_outdent = true;
          continue;
        }
        current[key] = val;
        continue;
      }
    }
    const m_top = _TOP_KEY_RE.exec(raw);
    if (m_top) {
      const key = m_top[1];
      const value = m_top[2];
      if (key === "deploy_roots" && !value) {
        in_tools = false;
        current = null;
        skip_until_outdent = true;
        continue;
      }
      if (key === "schema_version") {
        const parsed = parse_int_strict(value);
        data[key] = parsed === null ? value : parsed;
      } else {
        data[key] = value;
      }
      in_tools = false;
      current = null;
      skip_until_outdent = false;
    }
  }
  return data;
}
function splitlines3(text) {
  const parts = text.split("\n");
  if (parts.length > 0 && parts[parts.length - 1] === "") {
    parts.pop();
  }
  return parts;
}
function lstrip_spaces(s) {
  let i = 0;
  while (i < s.length && s[i] === " ") {
    i += 1;
  }
  return s.slice(i);
}
function parse_int_strict(value) {
  if (!/^[+-]?\d+$/.test(value.trim())) {
    return null;
  }
  return Number.parseInt(value, 10);
}
function _render2(version, tools, options = {}) {
  const deploy_roots = options.deploy_roots ?? null;
  const lines = [
    `schema_version: ${SCHEMA_VERSION3}`,
    `agent_config_version: "${version}"`
  ];
  if (deploy_roots && deploy_roots.length > 0) {
    lines.push("deploy_roots:");
    for (const root of deploy_roots) {
      lines.push(`  - ${root}`);
    }
  }
  lines.push("tools:");
  for (const tool of tools) {
    lines.push(`  - name: ${String(tool["name"])}`);
    lines.push(`    scope: ${String(tool["scope"])}`);
    lines.push(`    bridge_marker: ${String(tool["bridge_marker"])}`);
    lines.push(`    installed_at: "${String(tool["installed_at"])}"`);
    const status = tool["status"];
    if (status) {
      lines.push(`    status: ${String(status)}`);
    }
    let files = tool["files"] ?? [];
    if (files.length > 0) {
      files = stable_sort(files, (f) => [String(f["path"])]);
      lines.push("    files:");
      for (const entry of files) {
        lines.push(`      - path: ${String(entry["path"])}`);
        lines.push(`        kind: ${String(entry["kind"])}`);
        const sha = entry["sha256"];
        if (sha === null || sha === void 0) {
          lines.push("        sha256: null");
        } else {
          lines.push(`        sha256: "${String(sha)}"`);
        }
      }
    }
    let merged = tool["merged_keys"] ?? [];
    if (merged.length > 0) {
      merged = stable_sort(merged, (e) => [
        String(e["file"]),
        String(e["json_pointer"])
      ]);
      lines.push("    merged_keys:");
      for (const entry of merged) {
        lines.push(`      - file: ${String(entry["file"])}`);
        lines.push(`        json_pointer: "${String(entry["json_pointer"])}"`);
        const vh = entry["value_hash"];
        if (vh !== null && vh !== void 0) {
          lines.push(`        value_hash: "${String(vh)}"`);
        }
      }
    }
  }
  return lines.join("\n") + "\n";
}
function stable_sort(items, key) {
  return items.map((item, index) => ({ item, index, k: key(item) })).sort((a, b) => {
    const len = Math.max(a.k.length, b.k.length);
    for (let i = 0; i < len; i += 1) {
      const av = a.k[i] ?? "";
      const bv = b.k[i] ?? "";
      if (av < bv) return -1;
      if (av > bv) return 1;
    }
    return a.index - b.index;
  }).map((entry) => entry.item);
}
function write_manifest(path19, version, tools, options = {}) {
  const rendered = _render2(version, tools, { deploy_roots: options.deploy_roots ?? null });
  return write_atomic(path19, rendered);
}
var ScopeMismatchError = class extends Error {
  name_;
  recorded_scope;
  new_scope;
  constructor(name, recorded_scope, new_scope) {
    super(
      `tool '${name}' is committed as scope=${recorded_scope}; refusing to change it to scope=${new_scope} without --force`
    );
    this.name = "ScopeMismatchError";
    this.name_ = name;
    this.recorded_scope = recorded_scope;
    this.new_scope = new_scope;
  }
};
function upsert_tool(existing, options) {
  const {
    name,
    scope,
    bridge_marker,
    installed_at = null,
    force = false,
    files = null,
    merged_keys = null
  } = options;
  if (!_VALID_SCOPES.includes(scope)) {
    throw new ValueError(`scope must be one of ${_VALID_SCOPES.join(",")}: '${scope}'`);
  }
  const stamp = installed_at || _today();
  const _build = (prior = null) => {
    const entry = {
      name,
      scope,
      bridge_marker,
      installed_at: stamp
    };
    if (files !== null) {
      entry["files"] = [...files];
    } else if (prior !== null && Array.isArray(prior["files"]) && prior["files"].length > 0) {
      entry["files"] = [...prior["files"]];
    }
    if (merged_keys !== null) {
      entry["merged_keys"] = [...merged_keys];
    } else if (prior !== null && Array.isArray(prior["merged_keys"]) && prior["merged_keys"].length > 0) {
      entry["merged_keys"] = [...prior["merged_keys"]];
    }
    return entry;
  };
  const result = [];
  let found = false;
  for (const entry of existing) {
    if (entry["name"] === name) {
      found = true;
      const recorded = String(entry["scope"] ?? "");
      if (recorded === scope) {
        if (files === null && merged_keys === null) {
          result.push(entry);
        } else {
          const refreshed = _build(entry);
          refreshed["installed_at"] = entry["installed_at"] ?? stamp;
          result.push(refreshed);
        }
        continue;
      }
      if (!force) {
        throw new ScopeMismatchError(name, recorded, scope);
      }
      result.push(_build(entry));
      continue;
    }
    result.push(entry);
  }
  if (!found) {
    result.push(_build());
  }
  return result;
}
var ValueError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "ValueError";
  }
};
function _today() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}

// src/scripts/_lib/install_drift.ts
var import_yaml = __toESM(require_dist(), 1);
import * as crypto from "node:crypto";
import * as fs9 from "node:fs";
import * as os5 from "node:os";
import * as path8 from "node:path";
function expanduser5(p) {
  if (p === "~") {
    return os5.homedir();
  }
  if (p.startsWith("~/") || process.platform === "win32" && p.startsWith("~\\")) {
    return path8.join(os5.homedir(), p.slice(2));
  }
  return p;
}
function resolve_entry_path(project_root, raw) {
  const p = expanduser5(raw);
  return path8.isAbsolute(p) ? p : path8.join(project_root, p);
}
function sha256_of_file(p) {
  try {
    return crypto.createHash("sha256").update(fs9.readFileSync(p)).digest("hex");
  } catch {
    return null;
  }
}
function collect_drift(project_root, env) {
  const target = manifest_path(project_root, env);
  let text;
  try {
    text = fs9.readFileSync(target, "utf-8");
  } catch {
    return null;
  }
  let data;
  try {
    data = (0, import_yaml.parse)(text, { version: "1.1" });
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) {
    return null;
  }
  const tools = data["tools"];
  if (!Array.isArray(tools)) {
    return [];
  }
  const out = [];
  for (const tool of tools) {
    if (typeof tool !== "object" || tool === null) {
      continue;
    }
    const t = tool;
    const tool_id = t["name"] === void 0 ? "" : String(t["name"]);
    const files = t["files"];
    if (!Array.isArray(files)) {
      continue;
    }
    for (const entry of files) {
      if (typeof entry !== "object" || entry === null) {
        continue;
      }
      const e = entry;
      if (e["kind"] !== "deployed") {
        continue;
      }
      const recorded_sha256 = e["sha256"];
      if (typeof recorded_sha256 !== "string" || recorded_sha256 === "") {
        continue;
      }
      const raw_path = e["path"];
      if (typeof raw_path !== "string" || raw_path === "") {
        continue;
      }
      const resolved = resolve_entry_path(project_root, raw_path);
      if (!fs9.existsSync(resolved)) {
        out.push({
          tool_id,
          path: resolved,
          status: "missing",
          recorded_sha256,
          current_sha256: null
        });
        continue;
      }
      const current = sha256_of_file(resolved);
      if (current === recorded_sha256) {
        continue;
      }
      out.push({
        tool_id,
        path: resolved,
        status: "modified",
        recorded_sha256,
        current_sha256: current
      });
    }
  }
  out.sort((a, b) => {
    if (a.tool_id !== b.tool_id) {
      return a.tool_id < b.tool_id ? -1 : 1;
    }
    return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
  });
  return out;
}
function format_drift_report(entries) {
  if (entries === null) {
    return "Installer drift: no installed-tools manifest found \u2014 nothing to report.\n";
  }
  if (entries.length === 0) {
    return "Installer drift: no local modifications detected in framework-authoritative files.\n";
  }
  const lines = [];
  for (const e of entries) {
    const label = e.status === "missing" ? "missing " : "modified";
    lines.push(`  ${label}  [${e.tool_id}]  ${e.path}`);
  }
  const modified = entries.filter((e) => e.status === "modified").length;
  const missing = entries.filter((e) => e.status === "missing").length;
  lines.push("");
  lines.push(
    `Installer drift: ${entries.length} framework-authoritative file(s) locally modified since the last install (${modified} modified, ${missing} missing).`
  );
  return lines.join("\n") + "\n";
}

// src/scripts/_lib/skill_catalogue.ts
import * as fs10 from "node:fs";
import * as path9 from "node:path";
var OBSERVATION_LOG = path9.join(
  "agents",
  "evidence",
  "metrics",
  "skill-catalogue.jsonl"
);
function frontmatterOf(content) {
  if (!content.startsWith("---")) return "";
  const end = content.indexOf("\n---", 3);
  if (end === -1) return "";
  return content.slice(3, end);
}
function topLevelKeys(frontmatter) {
  const keys = [];
  for (const line of frontmatter.split("\n")) {
    const match = /^([A-Za-z_][A-Za-z0-9_-]*):/.exec(line);
    if (match) keys.push(match[1]);
  }
  return keys;
}
function descriptionOf(frontmatter) {
  const lines = frontmatter.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const match = /^description:\s*(.*)$/.exec(lines[i]);
    if (!match) continue;
    const rest = match[1].trim();
    if (/^[|>][-+]?\d*$/.test(rest)) {
      const body = [];
      for (let j = i + 1; j < lines.length; j += 1) {
        const line = lines[j];
        if (line.trim() === "") {
          body.push("");
          continue;
        }
        if (!/^\s/.test(line)) break;
        body.push(line.trim());
      }
      return body.join(" ").trim();
    }
    return rest.replace(/^["']|["']$/g, "");
  }
  return "";
}
function readProjectedCatalogue(root) {
  const names = fs10.readdirSync(root).filter((n) => fs10.existsSync(path9.join(root, n, "SKILL.md"))).sort();
  return names.map((name, index) => {
    const content = fs10.readFileSync(path9.join(root, name, "SKILL.md"), "utf-8");
    const frontmatter = frontmatterOf(content);
    const description = descriptionOf(frontmatter);
    return {
      name,
      position: index + 1,
      hasDescription: description.length > 0,
      descriptionLength: description.length,
      description,
      frontmatterKeys: topLevelKeys(frontmatter)
    };
  });
}
function truncationModeOf(record) {
  return record.truncation_mode ?? "per-entry";
}
function markdownFilesUnder(root) {
  if (!fs10.existsSync(root)) return [];
  const out = [];
  const walk = (dir) => {
    for (const entry of fs10.readdirSync(dir, { withFileTypes: true })) {
      const full = path9.join(dir, entry.name);
      if (fs10.statSync(full).isDirectory()) walk(full);
      else if (entry.name.endsWith(".md")) out.push(full);
    }
  };
  walk(root);
  return out;
}
function measureCatalogueVolume(host, root) {
  const skillsRoot = path9.join(root, "skills");
  const skills = fs10.existsSync(skillsRoot) ? readProjectedCatalogue(skillsRoot) : [];
  const commandEntries = markdownFilesUnder(path9.join(root, "commands")).length;
  return {
    host,
    root,
    skillEntries: skills.length,
    commandEntries,
    artefacts: skills.length + commandEntries,
    descriptionBytes: skills.reduce((sum, e) => sum + Buffer.byteLength(e.description), 0)
  };
}
function _supersedes(candidate, incumbent) {
  if (candidate.observed_at !== incumbent.observed_at) {
    return candidate.observed_at > incumbent.observed_at;
  }
  return (candidate.dropped_count ?? 0) > (incumbent.dropped_count ?? 0);
}
function knownHostLimits(records) {
  const out = /* @__PURE__ */ new Map();
  const chosen = /* @__PURE__ */ new Map();
  for (const record of records) {
    if (truncationModeOf(record) !== "budget-strip-and-drop") continue;
    if (typeof record.dropped_count !== "number") continue;
    if (record.dropped_count <= 0) continue;
    const previous = chosen.get(record.host);
    if (previous !== void 0 && !_supersedes(record, previous)) continue;
    chosen.set(record.host, record);
    out.set(record.host, {
      host: record.host,
      droppedEntries: record.dropped_count,
      projectedVolume: record.entries_total,
      projectedSkills: record.projected_skill_count ?? null,
      observedAt: record.observed_at
    });
  }
  return out;
}
function catalogueLimitWarning(volume, limit) {
  if (limit === void 0) return null;
  if (limit.projectedSkills === null) return null;
  if (volume.skillEntries < limit.projectedSkills) return null;
  return `${volume.host}: deploying ${volume.skillEntries} skills. This host reported dropping ${limit.droppedEntries} entries from the model-visible list when last measured (${limit.observedAt}, at ${limit.projectedSkills} skills) \u2014 that much never reaches the model. Explain: \`agent-config exec capture_skill_catalogue --limits\``;
}
function migrationEligibility(host, resolvedMode, currentSkillCount, limits) {
  if (resolvedMode === "scoped") return { eligible: false, reason: "already-scoped" };
  const limit = limits.get(host);
  if (limit === void 0) return { eligible: false, reason: "no-observation-for-host" };
  if (limit.projectedSkills === null) return { eligible: false, reason: "observation-not-comparable" };
  if (limit.droppedEntries <= 0) return { eligible: false, reason: "no-truncation-observed" };
  if (currentSkillCount < limit.projectedSkills) {
    return { eligible: false, reason: "below-observed-skill-volume" };
  }
  return {
    eligible: true,
    reason: "eligible",
    droppedEntries: limit.droppedEntries,
    observedAt: limit.observedAt
  };
}
function migrationPromptLines(host, eligibility, settingsPath) {
  return [
    `${host}: ${eligibility.droppedEntries} catalogue entries never reach the model.`,
    `Measured on this machine (${eligibility.observedAt}). This install is on \`legacy-all\`,`,
    "which ships everything and lets the host drop what does not fit \u2014 silently.",
    "",
    "Scoping the projection to your active packs is the alternative. Nothing here",
    "changes it for you: `projection.mode` is yours to set, by hand or in the GUI.",
    "",
    `  edit  ${settingsPath}`,
    "        projection:",
    "          mode: scoped",
    "",
    "  or    agent-config config      (Settings \u2192 projection)",
    "",
    "Keeping `legacy-all` is a legitimate choice \u2014 this is a notification, not a gate."
  ];
}
function readObservationLog(logPath) {
  if (!fs10.existsSync(logPath)) return [];
  const out = [];
  for (const line of fs10.readFileSync(logPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    try {
      out.push(JSON.parse(trimmed));
    } catch {
      continue;
    }
  }
  return out;
}

// src/shared/interactiveContext.ts
var CI_ENV_KEYS = ["CI", "GITHUB_ACTIONS", "AGENT_CONFIG_CI"];
function _flagSet(env, key) {
  const raw = (env[key] ?? "").trim();
  return raw !== "" && raw !== "0";
}
function nonInteractiveReason(probe) {
  for (const key of CI_ENV_KEYS) {
    if (_flagSet(probe.env, key)) {
      return "ci";
    }
  }
  if (_flagSet(probe.env, "AGENT_CONFIG_NO_UI")) {
    return "no-ui-requested";
  }
  if (!probe.stdinTty || !probe.stdoutTty) {
    return "not-a-tty";
  }
  if (probe.headless === true) {
    return "headless";
  }
  return null;
}
function isInteractiveSession(probe) {
  return nonInteractiveReason(probe) === null;
}

// src/scripts/_lib/claude_desktop_bundler.ts
import * as crypto2 from "node:crypto";
import * as fs11 from "node:fs";
import * as path10 from "node:path";

// src/scripts/_lib/zip_min.ts
import * as zlib from "node:zlib";
var LOCAL_HEADER_SIG = 67324752;
var CENTRAL_HEADER_SIG = 33639248;
var EOCD_SIG = 101010256;
var METHOD_DEFLATED = 8;
var DOS_TIME = 0;
var DOS_DATE = 33;
var CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(buf) {
  let c = 4294967295;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 255] ^ c >>> 8;
  }
  return (c ^ 4294967295) >>> 0;
}
function isAscii(s) {
  return /^[\x00-\x7f]*$/.test(s);
}
function zip_write_sync(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, "utf-8");
    const flags = isAscii(entry.name) ? 0 : 2048;
    const crc = crc32(entry.data);
    const compressed = zlib.deflateRawSync(entry.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL_HEADER_SIG, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(METHOD_DEFLATED, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBytes, compressed);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(CENTRAL_HEADER_SIG, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(flags, 8);
    cen.writeUInt16LE(METHOD_DEFLATED, 10);
    cen.writeUInt16LE(DOS_TIME, 12);
    cen.writeUInt16LE(DOS_DATE, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(compressed.length, 20);
    cen.writeUInt32LE(entry.data.length, 24);
    cen.writeUInt16LE(nameBytes.length, 28);
    cen.writeUInt16LE(0, 30);
    cen.writeUInt16LE(0, 32);
    cen.writeUInt16LE(0, 34);
    cen.writeUInt16LE(0, 36);
    cen.writeUInt32LE(0, 38);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBytes);
    offset += local.length + nameBytes.length + compressed.length;
  }
  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(EOCD_SIG, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...chunks, centralBuf, eocd]);
}

// src/scripts/_lib/claude_desktop_bundler.ts
var _EXCLUDED_BASENAMES = /* @__PURE__ */ new Set(["__pycache__", ".DS_Store"]);
var _EXCLUDED_PREFIXES = [".git"];
var _EXCLUDED_SUFFIXES = [".pyc", ".pyo"];
function _is_excluded(rel_parts) {
  for (const part of rel_parts) {
    if (_EXCLUDED_BASENAMES.has(part)) {
      return true;
    }
    if (_EXCLUDED_PREFIXES.some((prefix) => part.startsWith(prefix))) {
      return true;
    }
    if (_EXCLUDED_SUFFIXES.some((suffix) => part.endsWith(suffix))) {
      return true;
    }
  }
  return false;
}
function _is_dir(p) {
  try {
    return fs11.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
function _compare_rel_parts(a, b) {
  const ja = a.join("\0");
  const jb = b.join("\0");
  return ja < jb ? -1 : ja > jb ? 1 : 0;
}
function _walk_skill_files(skill_dir) {
  const out = [];
  const resolved = fs11.realpathSync(skill_dir);
  const walk = (root, relRoot) => {
    const dirNames = [];
    const fileNames = [];
    for (const dirent of fs11.readdirSync(root, { withFileTypes: true })) {
      const full = path10.join(root, dirent.name);
      const isDir2 = dirent.isDirectory() || dirent.isSymbolicLink() && _is_dir(full);
      if (isDir2) {
        dirNames.push(dirent.name);
      } else {
        fileNames.push(dirent.name);
      }
    }
    for (const fname of fileNames) {
      const rel_parts = [...relRoot, fname];
      if (_is_excluded(rel_parts)) {
        continue;
      }
      out.push([path10.join(root, fname), rel_parts]);
    }
    for (const dname of dirNames) {
      if (_is_excluded([dname])) {
        continue;
      }
      walk(path10.join(root, dname), [...relRoot, dname]);
    }
  };
  walk(resolved, []);
  out.sort((x, y) => _compare_rel_parts(x[1], y[1]));
  return out;
}
function _manifest_digest(files) {
  const h = crypto2.createHash("sha256");
  for (const [abs_path, rel_parts] of files) {
    const rel = rel_parts.join("/");
    h.update(Buffer.from(rel, "utf-8"));
    h.update(Buffer.from([0]));
    h.update(crypto2.createHash("sha256").update(fs11.readFileSync(abs_path)).digest());
    h.update(Buffer.from([0]));
  }
  return h.digest("hex");
}
function _atomic_write_zip(zip_path, files) {
  fs11.mkdirSync(path10.dirname(zip_path), { recursive: true });
  const stem = path10.basename(zip_path, path10.extname(zip_path));
  const tmp_path = path10.join(
    path10.dirname(zip_path),
    `.${stem}.${crypto2.randomBytes(6).toString("hex")}.zip.tmp`
  );
  try {
    const entries = files.map(([abs_path, rel_parts]) => ({
      name: rel_parts.join("/"),
      data: fs11.readFileSync(abs_path)
    }));
    fs11.writeFileSync(tmp_path, zip_write_sync(entries));
    fs11.renameSync(tmp_path, zip_path);
  } finally {
    if (fs11.existsSync(tmp_path)) {
      fs11.unlinkSync(tmp_path);
    }
  }
}
function _write_if_changed(dest_dir, slug, files, force, written) {
  const digest = _manifest_digest(files);
  const zip_path = path10.join(dest_dir, `${slug}.zip`);
  const digest_path = path10.join(dest_dir, `${slug}.sha256`);
  const recorded = fs11.existsSync(digest_path) ? fs11.readFileSync(digest_path, "utf-8").trim() : "";
  if (!force && recorded === digest && fs11.existsSync(zip_path)) {
    return;
  }
  _atomic_write_zip(zip_path, files);
  fs11.writeFileSync(digest_path, digest + "\n", "utf-8");
  written.push(zip_path);
}
function build_skill_bundles(package_root, dest_dir, force = false, curation = null) {
  const skills_root = path10.join(package_root, "dist/agent-src", "skills");
  if (!_is_dir(skills_root)) {
    return [];
  }
  fs11.mkdirSync(dest_dir, { recursive: true });
  const written = [];
  for (const name of fs11.readdirSync(skills_root).sort()) {
    const entry = path10.join(skills_root, name);
    const isSymlink2 = fs11.lstatSync(entry).isSymbolicLink();
    if (!(_is_dir(entry) || isSymlink2)) {
      continue;
    }
    const skill_name = name;
    if (curation !== null && !curation.includes(skill_name)) {
      continue;
    }
    const skill_md = path10.join(entry, "SKILL.md");
    if (!fs11.existsSync(skill_md)) {
      continue;
    }
    const files = _walk_skill_files(entry);
    if (files.length === 0) {
      continue;
    }
    _write_if_changed(dest_dir, skill_name, files, force, written);
  }
  return written;
}
function _command_slug(source_file, commands_root) {
  const rel = path10.relative(commands_root, source_file);
  const noExt = rel.slice(0, rel.length - path10.extname(rel).length);
  return noExt.split(path10.sep).join("-");
}
function _iter_command_files(commands_root) {
  const found = [];
  const walk = (dir) => {
    for (const dirent of fs11.readdirSync(dir, { withFileTypes: true })) {
      const full = path10.join(dir, dirent.name);
      if (dirent.isDirectory() || dirent.isSymbolicLink() && _is_dir(full)) {
        walk(full);
      } else if (dirent.name.endsWith(".md")) {
        found.push(full);
      }
    }
  };
  walk(commands_root);
  found.sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  return found.filter((source_file) => path10.basename(source_file) !== "AGENTS.md");
}
function build_command_bundles(package_root, dest_dir, force = false, curation = null) {
  const commands_root = path10.join(package_root, "dist/agent-src", "commands");
  if (!_is_dir(commands_root)) {
    return [];
  }
  const skills_root = path10.join(package_root, "dist/agent-src", "skills");
  let skill_names = /* @__PURE__ */ new Set();
  if (_is_dir(skills_root)) {
    skill_names = new Set(
      fs11.readdirSync(skills_root).filter((name) => _is_dir(path10.join(skills_root, name)))
    );
  }
  fs11.mkdirSync(dest_dir, { recursive: true });
  const written = [];
  for (const source_file of _iter_command_files(commands_root)) {
    const slug = _command_slug(source_file, commands_root);
    if (skill_names.has(slug)) {
      continue;
    }
    if (curation !== null && !curation.includes(slug)) {
      continue;
    }
    const files = [[fs11.realpathSync(source_file), ["SKILL.md"]]];
    _write_if_changed(dest_dir, slug, files, force, written);
  }
  return written;
}

// src/scripts/_lib/claude_settings_hooks.ts
var YAML = __toESM(require_dist(), 1);
import * as fs12 from "node:fs";
import * as path11 from "node:path";

// src/install/atomic.ts
import {
  closeSync as closeSync3,
  fsyncSync,
  mkdirSync as mkdirSync5,
  openSync as openSync3,
  readFileSync as readFileSync10,
  renameSync as renameSync5,
  unlinkSync as unlinkSync4,
  writeSync
} from "node:fs";
import { dirname as dirname4, join as join11 } from "node:path";
function atomicWriteFile(target, data, options = {}) {
  const mode = options.mode ?? 420;
  const parent = dirname4(target);
  mkdirSync5(parent, { recursive: true });
  const tmp = join11(parent, `.tmp.${process.pid}.${randSuffix()}`);
  let fd = null;
  try {
    fd = openSync3(tmp, "w", mode);
    const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
    writeSync(fd, buf, 0, buf.length, 0);
    fsyncSync(fd);
    closeSync3(fd);
    fd = null;
    renameSync5(tmp, target);
  } catch (err) {
    if (fd !== null) {
      try {
        closeSync3(fd);
      } catch {
      }
    }
    try {
      unlinkSync4(tmp);
    } catch {
    }
    throw err;
  }
}
function randSuffix() {
  return Math.floor(Math.random() * 281474976710655).toString(16).padStart(12, "0");
}

// src/scripts/_lib/claude_settings_hooks.ts
function _yaml_parse(text) {
  return YAML.parse(text);
}
var MANAGED_SIGNATURE = "dispatch:hook --platform claude";
var CorruptSettingsError = class extends Error {
  constructor(file, cause) {
    super(
      `${file} exists but is not valid JSON (${cause}). Refusing to overwrite a user-owned settings file \u2014 fix or remove it, then re-run.`
    );
    this.name = "CorruptSettingsError";
  }
};
var SettingsLockError = class extends Error {
  constructor(lockPath) {
    super(
      `settings lock ${lockPath} is held by another process. Re-run when the concurrent install finishes (stale lock: delete the file).`
    );
    this.name = "SettingsLockError";
  }
};
function build_claude_hook_matrix(manifest_path2) {
  const raw = fs12.readFileSync(manifest_path2, "utf8");
  const manifest = _yaml_parse(raw) ?? {};
  const hook_spec = manifest["schema_version"] ?? 1;
  const platforms = manifest["platforms"] ?? {};
  const claude_events = (platforms["claude"] ?? {}) || {};
  const aliasesAll = manifest["native_event_aliases"] ?? {};
  const aliases = (aliasesAll["claude"] ?? {}) || {};
  const ac_to_native = {};
  for (const [native, ac] of Object.entries(aliases)) {
    ac_to_native[String(ac)] = native;
  }
  const matrix = {};
  for (const [ac_event, concerns] of Object.entries(claude_events)) {
    if (!concerns || Array.isArray(concerns) && concerns.length === 0) continue;
    const native = ac_to_native[ac_event];
    if (native === void 0) continue;
    const dispatchArgs = `--platform claude --event ${ac_event} --native-event ${native} --project-dir "$CLAUDE_PROJECT_DIR" --min-version ${String(hook_spec)}`;
    matrix[native] = `B=""; [ -f "$CLAUDE_PROJECT_DIR/node_modules/@event4u/agent-config/dist/hooks/dispatch.js" ] && B="$CLAUDE_PROJECT_DIR/node_modules/@event4u/agent-config/dist/hooks/dispatch.js"; [ -z "$B" ] && [ -f "$CLAUDE_PROJECT_DIR/dist/hooks/dispatch.js" ] && [ -f "$CLAUDE_PROJECT_DIR/src/scripts/hook_manifest.yaml" ] && B="$CLAUDE_PROJECT_DIR/dist/hooks/dispatch.js"; if [ -n "$B" ] && command -v node >/dev/null 2>&1; then exec node "$B" ${dispatchArgs}; fi; BIN="$CLAUDE_PROJECT_DIR/agent-config"; [ -x "$BIN" ] || BIN=agent-config; command -v "$BIN" >/dev/null 2>&1 || exit 0; "$BIN" dispatch:hook ${dispatchArgs}`;
  }
  return matrix;
}
function _is_managed_group(group) {
  if (typeof group !== "object" || group === null || Array.isArray(group)) return false;
  const hooks = group.hooks;
  if (!Array.isArray(hooks)) return false;
  return hooks.some(
    (h) => typeof h === "object" && h !== null && typeof h.command === "string" && h.command.includes(MANAGED_SIGNATURE)
  );
}
function _read_settings(settings_path) {
  if (!fs12.existsSync(settings_path)) return {};
  const raw = fs12.readFileSync(settings_path, "utf8");
  if (raw.trim() === "") return {};
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new CorruptSettingsError(settings_path, e.message);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new CorruptSettingsError(settings_path, "top level is not an object");
  }
  return parsed;
}
function _with_lock(settings_path, fn) {
  const lockPath = settings_path + ".agent-config.lock";
  fs12.mkdirSync(path11.dirname(lockPath), { recursive: true });
  let fd;
  try {
    fd = fs12.openSync(lockPath, "wx");
  } catch {
    throw new SettingsLockError(lockPath);
  }
  try {
    return fn();
  } finally {
    fs12.closeSync(fd);
    fs12.rmSync(lockPath, { force: true });
  }
}
function ensure_managed_hooks(settings_path, matrix) {
  return _with_lock(settings_path, () => {
    const settings = _read_settings(settings_path);
    const before = JSON.stringify(settings);
    const hooks = (settings["hooks"] ?? {}) || {};
    const touched = [];
    for (const [native, command] of Object.entries(matrix)) {
      const existing = Array.isArray(hooks[native]) ? hooks[native] : [];
      const user_groups = existing.filter((g) => !_is_managed_group(g));
      const managed_group = {
        hooks: [{ type: "command", command }]
      };
      const next = [...user_groups, managed_group];
      if (JSON.stringify(next) !== JSON.stringify(existing)) touched.push(native);
      hooks[native] = next;
    }
    settings["hooks"] = hooks;
    const after = JSON.stringify(settings);
    if (after === before) {
      return { changed: false, events: [] };
    }
    atomicWriteFile(settings_path, JSON.stringify(settings, null, 2) + "\n");
    return { changed: true, events: touched };
  });
}

// src/scripts/_lib/agent_settings.ts
import { createRequire as createRequire2 } from "node:module";
import * as fs13 from "node:fs";
import * as os6 from "node:os";
import * as path12 from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";

// src/shared/settingsCarveOut.ts
var SETTINGS_CARVE_OUT = [
  {
    key: "projection.mode",
    reader: "src/scripts/install.ts:3409 _resolve_scoped_projection",
    absentResolvesTo: "legacy-all",
    reason: "The template fallback applies only when NO global settings file exists. Once a file exists, an absent key means legacy-all by documented contract, so an existing install is never silently narrowed on upgrade."
  },
  {
    key: "projection.rule_workspaces",
    reader: "src/install/rule_scope.ts:96 ruleScopeFromSettings",
    absentResolvesTo: "null \u2014 LEGACY_ALL, i.e. every rule ships including maintainer-only ones",
    reason: "Same upgrade contract as projection.mode, and the failure is louder: an absent list widens the projection instead of narrowing it."
  },
  {
    key: "discipline_profile",
    reader: "work_engine/_lib/agent_settings.ts:1263",
    absentResolvesTo: "essential, unconditionally",
    reason: "The template ships `auto`, which resolves to `off` on any measured-null model, any non-Claude host, and any host exposing no model id. Absent skips that resolution entirely and loads the essential tier everywhere."
  },
  {
    key: "chat_history.frequency",
    reader: "src/scripts/chat_history.ts:1140",
    absentResolvesTo: "per_phase",
    reason: "Canonical substitution is `per_turn`. Absent gives coarser capture than the shipped default \u2014 an audit-thinning change, which the class contract's own test 8 (what can the attacker HIDE) names as the severe direction."
  },
  {
    key: "profile.id",
    reader: "src/scripts/config/profiles.ts:221 resolve_profile",
    absentResolvesTo: "the id `developer`, but a DEGRADED profile \u2014 packs: [], personas: [], hints: []",
    reason: "Exactly the projection.mode shape: the template default is honoured only when no settings file exists. With a file present the id resolves but its profile body does not load, so the install silently loses every pack and persona."
  },
  {
    key: "quality.local_auto_run",
    reader: "src/scripts/lint_roadmap_ci_steps.ts:106",
    absentResolvesTo: "true \u2014 which DISABLES the CI-step gate",
    reason: "Inverted polarity, and the most dangerous row in the set: the template ships `false`, which ARMS the gate. Omitting the key would disarm a quality gate for every fresh install while the reference page says it is on."
  },
  {
    key: "onboarding.onboarded",
    reader: "src/scripts/onboarding_gate_hook.ts:99",
    absentResolvesTo: "gate skipped, as if onboarding had already completed",
    reason: "Absent behaves like `onboarded: true`, not like the template default `false`. Omitting it would skip the onboarding gate on precisely the fresh installs the gate exists for."
  },
  {
    key: "chat_history.enabled",
    reader: "src/scripts/chat_history.ts:1025 _read_chat_history_enabled",
    absentResolvesTo: "false",
    reason: "The reader falls back to false while the template ships true. This one is privacy-shaped: fixing the reader would start recording history for every install whose file lacks the key. Writing it explicitly keeps the decision visible in the file the user can read."
  }
];
function carveOutKeys() {
  return SETTINGS_CARVE_OUT.map((c) => c.key);
}

// src/scripts/_lib/agent_settings.ts
var _require2 = createRequire2(import.meta.url);
var Logger = class {
  name = "scripts._lib.agent_settings";
  records = [];
  info(message, ...args) {
    this.records.push({ level: "INFO", message: _format(message, args) });
  }
  warning(message, ...args) {
    this.records.push({ level: "WARNING", message: _format(message, args) });
  }
};
function _format(template, args) {
  let i = 0;
  return template.replace(/%s/g, () => {
    if (i < args.length) {
      const value = args[i];
      i += 1;
      return _pystr(value);
    }
    return "%s";
  });
}
function _pystr(value) {
  if (Array.isArray(value)) {
    return `[${value.map((v) => _pyrepr(v)).join(", ")}]`;
  }
  return String(value);
}
function _pyrepr(value) {
  if (typeof value === "string") {
    return `'${value}'`;
  }
  return String(value);
}
var logger = new Logger();
var DEFAULT_PROJECT_FILE = ".agent-settings.yml";
var LOCAL_PROJECT_FILE = ".agent-settings.local.yml";
var LOCAL_PROJECT_SUBDIR = ["agents", "settings"];
function _local_settings_path(project_root) {
  return path12.join(project_root, ...LOCAL_PROJECT_SUBDIR, LOCAL_PROJECT_FILE);
}
function _canonical_settings_path(project_root) {
  return path12.join(project_root, ...LOCAL_PROJECT_SUBDIR, DEFAULT_PROJECT_FILE);
}
var USER_GLOBAL_FILENAME = "agent-settings.yml";
function DEFAULT_USER_GLOBAL_FILE() {
  return write_target(USER_GLOBAL_FILENAME);
}
var USER_GLOBAL_CANONICAL_RELATIVE = "settings/.agent-settings.yml";
function user_global_settings_paths() {
  const paths = [];
  const flat = resolve_with_fallback(USER_GLOBAL_FILENAME);
  if (flat !== null) {
    paths.push(flat);
  }
  const canonical = resolve_with_fallback(USER_GLOBAL_CANONICAL_RELATIVE);
  if (canonical !== null) {
    paths.push(canonical);
  }
  if (paths.length === 0) {
    paths.push(DEFAULT_USER_GLOBAL_FILE());
  }
  return paths;
}
var MERGEABLE_KEYS = [
  // `name`, `ide` and `personal.bot_icon` are the PRE-MIGRATION spellings.
  // `install.ts` migrates `ide` → `personal.ide` and `pr_comment_bot_icon`
  // into its `personal.` home, and this list was never moved with them — so
  // the whitelist named keys the template does not have while the keys it
  // does have were filtered out silently. A user setting either preference
  // user-globally got no error, no warning, and no effect
  // (road-to-capability-answerability 4.3, ADR-219).
  //
  // Both spellings are listed rather than replaced: a legacy file that still
  // uses the old name keeps working, and nothing that resolved before
  // resolves differently. `name` has no reader anywhere and no template key;
  // it is kept only so this change stays purely additive.
  "name",
  "ide",
  "personal.ide",
  "rule_loading_tier",
  "memory.cadence",
  "personal.bot_icon",
  "personal.pr_comment_bot_icon",
  "personal.autonomy",
  // Knowledge-card global cross-project sharing is a USER-GLOBAL setting
  // (ADR-100 / road-to-structure-grounding-v2). Whitelisted so the
  // ~/.event4u/agent-config/agent-settings.yml values are honoured.
  "knowledge.global_sharing.enabled",
  "knowledge.global_sharing.allowed_tiers",
  "knowledge.global_sharing.redaction.enabled",
  "knowledge.global_sharing.redaction.halt_on_trigger",
  "knowledge.global_sharing.auto_promote_threshold",
  "knowledge.global_sharing.freshness.hypothesis_after_days",
  "knowledge.global_sharing.freshness.stale_after_days"
];
var TEMPLATE_RELATIVE = path12.join("src", "config", "agent-settings.template.yml");
var _PACKAGE_ROOT = path12.resolve(path12.dirname(fileURLToPath2(import.meta.url)), "..", "..", "..");
function default_template_path() {
  return path12.join(_PACKAGE_ROOT, TEMPLATE_RELATIVE);
}
function _is_placeholder(value) {
  return typeof value === "string" && /^__[A-Z0-9_]+__$/.test(value);
}
function _prune_template(tree, excluded, prefix = "") {
  const out = {};
  for (const [key, value] of Object.entries(tree)) {
    const dotted = prefix === "" ? key : `${prefix}.${key}`;
    if (excluded.has(dotted) || _is_placeholder(value)) {
      continue;
    }
    if (_is_plain_dict(value)) {
      const child = _prune_template(value, excluded, dotted);
      if (Object.keys(child).length > 0) {
        out[key] = child;
      }
      continue;
    }
    out[key] = value;
  }
  return out;
}
var _template_defaults_cache = null;
function template_defaults(template_path) {
  const use_cache = template_path === void 0;
  if (use_cache && _template_defaults_cache !== null) {
    return _deepcopy(_template_defaults_cache);
  }
  const parsed = _read_yaml(template_path ?? default_template_path()) ?? {};
  const pruned = _prune_template(parsed, new Set(carveOutKeys()));
  if (use_cache) {
    _template_defaults_cache = pruned;
  }
  return _deepcopy(pruned);
}
var ANCHOR_AGENT_SETTINGS = "agent-settings";
var ANCHOR_AGENTS_DIR = "agents-dir";
var ANCHOR_GIT = "git";
var _AGENTS_DIR_MARKERS = [
  "roadmaps",
  "settings/.ai-council.yml",
  "roadmaps-progress.md",
  // `overrides/` is the guaranteed minimal-consumer surface (ADR-020).
  // Replaced the retired `.event4u-bridge.yml` marker (ADR-020 amendment
  // 2026-07-13) so a bare consumer `agents/` dir stays anchorable.
  "overrides"
];
var _LEGACY_ANCHOR_ENV = "AGENT_CONFIG_LEGACY_ANCHOR";
function _exists(p) {
  try {
    fs13.lstatSync(p);
    fs13.statSync(p);
    return true;
  } catch {
    return false;
  }
}
function _is_dir2(p) {
  try {
    return fs13.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
function _is_file(p) {
  try {
    return fs13.statSync(p).isFile();
  } catch {
    return false;
  }
}
function _resolve(p) {
  const absolute = path12.resolve(p);
  try {
    return fs13.realpathSync(absolute);
  } catch {
    return absolute;
  }
}
function _ancestor_chain(start) {
  const chain = [];
  let cursor = start;
  for (; ; ) {
    chain.push(cursor);
    const parent = path12.dirname(cursor);
    if (parent === cursor) {
      break;
    }
    cursor = parent;
  }
  return chain;
}
function _boundary_anchor_at(dir) {
  const agents_dir = path12.join(dir, "agents");
  if (_is_dir2(agents_dir)) {
    for (const marker of _AGENTS_DIR_MARKERS) {
      if (_exists(path12.join(agents_dir, marker))) {
        return ANCHOR_AGENTS_DIR;
      }
    }
  }
  if (_exists(path12.join(dir, ".git"))) {
    return ANCHOR_GIT;
  }
  return null;
}
function find_project_root_with_anchor(start) {
  const current = _exists(start) ? _resolve(start) : start;
  const legacy = process.env[_LEGACY_ANCHOR_ENV] === "1";
  const chain = _ancestor_chain(current);
  if (legacy) {
    for (const candidate of chain) {
      if (_exists(path12.join(candidate, ".git"))) {
        return [candidate, ANCHOR_GIT];
      }
    }
    return null;
  }
  for (const candidate of chain) {
    const anchor = _boundary_anchor_at(candidate);
    if (anchor !== null) {
      return [candidate, anchor];
    }
  }
  let outermost = null;
  for (const candidate of chain) {
    if (_exists(path12.join(candidate, DEFAULT_PROJECT_FILE))) {
      outermost = candidate;
    }
  }
  if (outermost !== null) {
    return [outermost, ANCHOR_AGENT_SETTINGS];
  }
  return null;
}
function find_project_root(start) {
  const result = find_project_root_with_anchor(start);
  return result !== null ? result[0] : null;
}
var ORIGIN_ROOT_FLAG = "root-flag";
var ORIGIN_EXPLICIT = "explicit";
var ORIGIN_ENV = "env";
var ORIGIN_CWD_FALLBACK = "cwd-fallback";
var PROJECT_ROOT_ENV = "AGENT_CONFIG_PROJECT_ROOT";
var ROOT_OVERRIDE_ENV = "AGENT_CONFIG_ROOT_OVERRIDE";
var ProjectRootError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "ProjectRootError";
  }
};
function _validate_root_path(p, origin_label) {
  const resolved = _expanduser(p);
  if (!_exists(resolved)) {
    throw new ProjectRootError(
      `${origin_label} points to a path that does not exist: ${resolved}`
    );
  }
  if (!_is_dir2(resolved)) {
    throw new ProjectRootError(
      `${origin_label} points to a non-directory: ${resolved}`
    );
  }
  return _resolve(resolved);
}
function _expanduser(p) {
  if (p === "~") {
    return os6.homedir();
  }
  if (p.startsWith("~/") || process.platform === "win32" && p.startsWith("~\\")) {
    return path12.join(os6.homedir(), p.slice(2));
  }
  return p;
}
function resolve_project_root(arg, options = {}) {
  const cwd = options.cwd ?? null;
  if (process.env[ROOT_OVERRIDE_ENV] === "1") {
    const env_value2 = process.env[PROJECT_ROOT_ENV];
    if (env_value2) {
      return [_validate_root_path(env_value2, "--root"), ORIGIN_ROOT_FLAG];
    }
  }
  if (arg !== null && String(arg) !== "") {
    return [_validate_root_path(arg, "--project"), ORIGIN_EXPLICIT];
  }
  const env_value = process.env[PROJECT_ROOT_ENV];
  if (env_value) {
    return [_validate_root_path(env_value, PROJECT_ROOT_ENV), ORIGIN_ENV];
  }
  const start = _resolve(cwd ?? process.cwd());
  const walked = find_project_root_with_anchor(start);
  if (walked !== null) {
    return walked;
  }
  return [start, ORIGIN_CWD_FALLBACK];
}
function _resolve_cascade_paths(cwd, project_path) {
  if (cwd === null) {
    const legacy = project_path ? project_path : DEFAULT_PROJECT_FILE;
    const parent = path12.dirname(legacy);
    return [legacy, _canonical_settings_path(parent), _local_settings_path(parent)];
  }
  const root = find_project_root(cwd);
  if (root === null) {
    const legacy = project_path ? project_path : DEFAULT_PROJECT_FILE;
    const parent = path12.dirname(legacy);
    return [legacy, _canonical_settings_path(parent), _local_settings_path(parent)];
  }
  const cwd_resolved = _resolve(cwd);
  const chain = [];
  let cursor = cwd_resolved;
  for (; ; ) {
    chain.push(cursor);
    if (cursor === root) {
      break;
    }
    const parent = path12.dirname(cursor);
    if (parent === cursor) {
      break;
    }
    cursor = parent;
  }
  chain.reverse();
  return [
    ...chain.map((d) => path12.join(d, DEFAULT_PROJECT_FILE)),
    _canonical_settings_path(root),
    _local_settings_path(root)
  ];
}
function load_agent_settings(options = {}) {
  const project_path = options.project_path ?? null;
  const user_global_path = options.user_global_path ?? null;
  const verbose = options.verbose ?? false;
  const cwd = options.cwd ?? null;
  const template_path = options.template_path ?? null;
  const user_global_raw = {};
  for (const p of user_global_path ? [user_global_path] : user_global_settings_paths()) {
    _deep_merge(user_global_raw, _read_yaml(p) ?? {});
  }
  const [user_global_filtered, ignored] = _filter_whitelist(user_global_raw, MERGEABLE_KEYS);
  if (verbose && ignored.length > 0) {
    logger.info(
      "agent_settings: ignored non-whitelisted user-global keys: %s",
      [...ignored].sort()
    );
  }
  const cascade = _resolve_cascade_paths(cwd, project_path);
  const merged = template_defaults(template_path ?? void 0);
  _deep_merge(merged, user_global_filtered);
  for (const p of cascade) {
    const layer = _read_yaml(p) ?? {};
    if (Object.keys(layer).length > 0) {
      _deep_merge(merged, layer);
    }
  }
  _warn_removed_always_on_keys(merged);
  return merged;
}
var REMOVED_KEYS = /* @__PURE__ */ new Map([
  ["subagents.enabled", "always-on orchestration"],
  ["subagents.auto", "always-on orchestration"],
  ["subagents.host_capabilities", "always-on orchestration"],
  ["subagents.budget_routing", "always-on orchestration"],
  ["ai_team.enabled", "always-on orchestration"],
  ["hooks.turn_end_gate.enabled", "the turn-end gate is always armed"],
  ["hooks.turn_end_gate.promissory", "the turn-end gate is always armed"],
  ["hooks.turn_end_gate.language", "the turn-end gate is always armed"],
  ["hooks.turn_end_gate.verification", "the turn-end gate is always armed"],
  ["telegraph.speak_scope", "the rule body states its own scope; compile_router gates on telegraph.speak alone"],
  ["chat_history.max_size_kb", "the rotate command takes --max-kb from argv; session-count pruning bounds the file"],
  ["chat_history.on_overflow", "the overflow mode comes from the rotate command --mode argv"],
  ["quality.wait_for_remote_ci", "whether to poll follows from the push plus a detectable remote pipeline"],
  ["legal_review_prep.consented_at", "the provenance sidecar settings:set writes and consentVerdict reads"],
  ["worktrees.mode", "the user asking for a worktree in the chat; creation is instruction-only and hardcoded"]
]);
var _warnedRemovedKeys = /* @__PURE__ */ new Set();
function _readDottedSettingsPath(root, dotted) {
  let node = root;
  for (const part of dotted.split(".")) {
    if (typeof node !== "object" || node === null || Array.isArray(node)) {
      return void 0;
    }
    node = node[part];
  }
  return node;
}
function _warn_removed_always_on_keys(merged) {
  for (const [key, reason] of REMOVED_KEYS) {
    if (_warnedRemovedKeys.has(key)) {
      continue;
    }
    if (_readDottedSettingsPath(merged, key) === void 0) {
      continue;
    }
    _warnedRemovedKeys.add(key);
    process.stderr.write(`${key} was removed (${reason}); ignored.
`);
  }
}
function _read_yaml(p) {
  if (!_is_file(p)) {
    return null;
  }
  let YAML3;
  try {
    YAML3 = _require2("yaml");
  } catch {
    return null;
  }
  let data;
  try {
    const text = fs13.readFileSync(p, "utf-8");
    data = YAML3.parse(text, { version: "1.1" });
    if (data === null || data === void 0) {
      data = {};
    }
  } catch (err) {
    if (_is_yaml_error(err) || _is_os_error(err)) {
      logger.warning("agent_settings: unreadable or malformed YAML at %s", p);
      return null;
    }
    throw err;
  }
  return _is_plain_dict(data) ? data : null;
}
function _is_yaml_error(err) {
  if (err instanceof Error) {
    return err.name.startsWith("YAML") || err.name === "Error" || err.name === "TypeError";
  }
  return false;
}
function _is_os_error(err) {
  return typeof err === "object" && err !== null && "code" in err && typeof err.code === "string";
}
function _filter_whitelist(raw, allowed) {
  const filtered = {};
  for (const dotted of allowed) {
    const value = _get_dotted(raw, dotted);
    if (value !== null && value !== void 0) {
      _set_dotted(filtered, dotted, value);
    }
  }
  const ignored = _leaf_paths(raw).filter((p) => !allowed.includes(p));
  return [filtered, ignored];
}
function _get_dotted(data, dotted) {
  let cursor = data;
  for (const part of dotted.split(".")) {
    if (!_is_plain_dict(cursor) || !(part in cursor)) {
      return null;
    }
    cursor = cursor[part];
  }
  return cursor;
}
function _set_dotted(target, dotted, value) {
  const parts = dotted.split(".");
  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    let nxt = cursor[part];
    if (nxt === void 0) {
      nxt = {};
      cursor[part] = nxt;
    }
    if (!_is_plain_dict(nxt)) {
      nxt = {};
      cursor[part] = nxt;
    }
    cursor = nxt;
  }
  cursor[parts[parts.length - 1]] = value;
}
function _leaf_paths(data, prefix = "") {
  const paths = [];
  for (const [key, value] of Object.entries(data)) {
    const p = prefix ? `${prefix}.${key}` : key;
    if (_is_plain_dict(value) && Object.keys(value).length > 0) {
      paths.push(..._leaf_paths(value, p));
    } else {
      paths.push(p);
    }
  }
  return paths;
}
function _deep_merge(dst, src) {
  for (const [key, value] of Object.entries(src)) {
    if (_is_plain_dict(value) && _is_plain_dict(dst[key])) {
      _deep_merge(dst[key], value);
    } else {
      dst[key] = value;
    }
  }
}
function _deepcopy(value) {
  if (Array.isArray(value)) {
    return value.map((v) => _deepcopy(v));
  }
  if (_is_plain_dict(value)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = _deepcopy(v);
    }
    return out;
  }
  return value;
}
function _is_plain_dict(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// src/install/rule_scope.ts
import * as path13 from "node:path";

// src/install/ruleInScope.ts
var YAML2 = __toESM(require_dist(), 1);
import * as fs14 from "node:fs";
function parseYaml2(text) {
  try {
    const data = YAML2.parse(text, { version: "1.1" });
    return data === void 0 ? null : data;
  } catch {
    return null;
  }
}
function strip(s) {
  return s.replace(/^\s+/u, "").replace(/\s+$/u, "");
}
function lstripNewlines(s) {
  return s.replace(/^\n+/, "");
}
function parseFrontmatter(content) {
  if (!content.startsWith("---")) {
    return [{}, content];
  }
  const end = content.indexOf("\n---", 3);
  if (end === -1) {
    return [{}, content];
  }
  const raw = strip(content.slice(3, end));
  const body = lstripNewlines(content.slice(end + 4));
  let meta = parseYaml2(raw);
  if (meta === null || meta === void 0) {
    meta = {};
  }
  if (typeof meta === "object" && meta !== null && !Array.isArray(meta)) {
    return [meta, body];
  }
  return [{}, body];
}
function rule_in_scope(source_path, scope, pack_scope = null, role_scope = null) {
  if (scope === null && pack_scope === null && role_scope === null) {
    return true;
  }
  const [meta] = parseFrontmatter(fs14.readFileSync(source_path, "utf-8"));
  if (meta["type"] === "always" || meta["alwaysApply"] === true) {
    return true;
  }
  const axis = (key, configured) => {
    if (configured === null) {
      return true;
    }
    const values = Array.isArray(meta[key]) ? meta[key].map((w) => String(w)) : [];
    if (values.length === 0) {
      return true;
    }
    return values.some((v) => configured.includes(v));
  };
  return axis("workspaces", scope) && axis("packs", pack_scope) && axis("roles", role_scope);
}

// src/install/rule_scope.ts
var COMPAT_ALWAYS_EXCLUDED = ["source-of-truth.md"];
var LEGACY_ALL = { workspaces: null, packs: null };
function _list(value) {
  if (Array.isArray(value) && value.length > 0) {
    return value.map((v) => String(v));
  }
  return null;
}
function ruleScopeFromSettings(settings, packageRoot) {
  const proj = settings["projection"];
  if (typeof proj !== "object" || proj === null || Array.isArray(proj)) {
    return LEGACY_ALL;
  }
  const p = proj;
  const packs = packageRoot === void 0 ? _list(p["rule_packs"]) : resolve_rule_pack_scope(
    p["rule_packs"],
    packageRoot,
    _list(_runtimeActivePacks(settings)) ?? []
  );
  return {
    workspaces: _list(p["rule_workspaces"]),
    packs,
    roles: _list(p["rule_roles"])
  };
}
function _runtimeActivePacks(settings) {
  const rt = settings["runtime"];
  return typeof rt === "object" && rt !== null && !Array.isArray(rt) ? rt["active_packs"] : null;
}
function ruleFileArrives(sourcePath, scope) {
  if (!sourcePath.endsWith(".md")) {
    return true;
  }
  const basename6 = path13.basename(sourcePath);
  if (COMPAT_ALWAYS_EXCLUDED.includes(basename6)) {
    return false;
  }
  return rule_in_scope(sourcePath, scope.workspaces, scope.packs, scope.roles ?? null);
}

// src/install/partitionEligibility.ts
import * as fs16 from "node:fs";
import * as os7 from "node:os";

// src/install/hostLayerFingerprint.ts
import { createHash as createHash4 } from "node:crypto";
import * as fs15 from "node:fs";
import * as path14 from "node:path";
var FINGERPRINT_SCHEMA = 1;
function collectFiles(dir) {
  const out = [];
  const walk = (d) => {
    let entries;
    try {
      entries = fs15.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    const sorted = [...entries].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    for (const e of sorted) {
      const p = path14.join(d, e.name);
      if (e.isDirectory()) {
        walk(p);
      } else if (e.isFile()) {
        out.push(p);
      }
    }
  };
  walk(dir);
  return out.sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
}
function fingerprintLayers(layers) {
  const h = createHash4("sha256");
  h.update(`v${FINGERPRINT_SCHEMA}\0`);
  for (const layer of layers) {
    h.update(`layer:${layer.label}\0`);
    for (const file of collectFiles(layer.root)) {
      h.update(path14.relative(layer.root, file));
      h.update("\0");
      try {
        h.update(fs15.readFileSync(file));
      } catch {
        h.update("\0unreadable\0");
      }
      h.update("\0");
    }
  }
  return h.digest("hex");
}
function hostLayerInputs(userHome) {
  const claude = path14.join(userHome, ".claude");
  return [
    { label: "rules", root: path14.join(claude, "rules") },
    { label: "skills", root: path14.join(claude, "skills") },
    { label: "commands", root: path14.join(claude, "commands") }
  ];
}

// src/install/partitionEligibility.ts
var MAINTAINER_WORKSPACE = "agent-config-maintainer";
function isExclusivelyPackageOnly(source_path) {
  let meta;
  try {
    [meta] = parseFrontmatter(fs16.readFileSync(source_path, "utf-8"));
  } catch {
    return false;
  }
  const raw = meta["workspaces"];
  if (!Array.isArray(raw) || raw.length === 0) {
    return false;
  }
  return raw.every((w) => String(w) === MAINTAINER_WORKSPACE);
}
function stampHostLayerFingerprint(installedVersion, tools, lockfilePath, skip2, report) {
  if (skip2) {
    return null;
  }
  try {
    const fingerprint = fingerprintLayers(hostLayerInputs(os7.homedir()));
    write_lockfile(installedVersion, [...tools], {
      path: lockfilePath,
      host_layer_fingerprint: fingerprint
    });
    report(`Host-layer fingerprint recorded: ${fingerprint.slice(0, 12)} (enables single delivery)`);
    return fingerprint;
  } catch (e) {
    report(
      `Host-layer fingerprint NOT recorded (${String(e)}) \u2014 the project layer keeps the full projection.`
    );
    return null;
  }
}

// src/install/wizard-plan.ts
var RULE_SOURCE_REL = "dist/agent-src/rules";

// src/shared/settingsSurface.ts
function unwrapRef(root) {
  if (root.$ref !== void 0 && root.definitions !== void 0) {
    const name = root.$ref.replace("#/definitions/", "");
    const def = root.definitions[name];
    if (def !== void 0) return def;
  }
  return root;
}
function flattenSurface(schema, version) {
  const entries = {};
  const walk = (node, prefix) => {
    if (node.type === "object" && node.properties !== void 0 && Object.keys(node.properties).length > 0) {
      for (const key of Object.keys(node.properties).sort()) {
        const child = node.properties[key];
        walk(child, prefix === "" ? key : `${prefix}.${key}`);
      }
      return;
    }
    if (prefix === "") return;
    const entry = { type: node.type ?? (node.enum !== void 0 ? "enum" : "unknown") };
    if (node.default !== void 0) entry.default = node.default;
    if (node.enum !== void 0) entry.enum = [...node.enum];
    if (node.description !== void 0) entry.description = node.description;
    entries[prefix] = entry;
  };
  walk(unwrapRef(schema), "");
  return { version, entries };
}
function sameJson(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}
function computeSurfaceDelta(oldS, newS) {
  const changes = [];
  const oldKeys = new Set(Object.keys(oldS.entries));
  const newKeys = new Set(Object.keys(newS.entries));
  for (const key of [...newKeys].sort()) {
    const n = newS.entries[key];
    if (!oldKeys.has(key)) {
      changes.push({ key, kind: "added", new: n });
      continue;
    }
    const o = oldS.entries[key];
    if (o.type !== n.type) {
      changes.push({ key, kind: "type_changed", old: o, new: n });
    }
    if (!sameJson(o.default, n.default)) {
      changes.push({ key, kind: "default_changed", old: o, new: n });
    }
    const oldEnum = new Set(o.enum ?? []);
    const newEnum = new Set(n.enum ?? []);
    if (o.enum !== void 0 || n.enum !== void 0) {
      const addedVals = [...newEnum].filter((v) => !oldEnum.has(v));
      const removedVals = [...oldEnum].filter((v) => !newEnum.has(v));
      if (addedVals.length > 0) {
        changes.push({ key, kind: "enum_added", old: o, new: n, values: addedVals });
      }
      if (removedVals.length > 0) {
        changes.push({ key, kind: "enum_removed", old: o, new: n, values: removedVals });
      }
    }
  }
  for (const key of [...oldKeys].sort()) {
    if (!newKeys.has(key)) {
      changes.push({ key, kind: "removed", old: oldS.entries[key] });
    }
  }
  return { oldVersion: oldS.version, newVersion: newS.version, changes };
}

// node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});

// node_modules/zod/v3/helpers/util.js
var util;
(function(util2) {
  util2.assertEqual = (_) => {
  };
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};

// node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};
var ZodError = class _ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};

// node_modules/zod/v3/locales/en.js
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
var en_default = errorMap;

// node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}

// node_modules/zod/v3/helpers/parseUtil.js
var makeIssue = (params) => {
  const { data, path: path19, errorMaps, issueData } = params;
  const fullPath = [...path19, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
var ParseStatus = class _ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x) => x.status === "aborted";
var isDirty = (x) => x.status === "dirty";
var isValid = (x) => x.status === "valid";
var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;

// node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

// node_modules/zod/v3/types.js
var ParseInputLazyPath = class {
  constructor(parent, value, path19, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path19;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
var ZodType = class {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
var ZodString = class _ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
var ZodNumber = class _ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodBigInt = class _ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
var ZodBoolean = class extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodDate = class _ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var ZodSymbol = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var ZodUndefined = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var ZodNull = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var ZodAny = class extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var ZodUnknown = class extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var ZodNever = class extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var ZodVoid = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var ZodArray = class _ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
var ZodObject = class _ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") {
      } else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var ZodUnion = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};
var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
var ZodIntersection = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var ZodTuple = class _ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var ZodRecord = class _ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
var ZodMap = class extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var ZodSet = class _ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var ZodFunction = class _ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
var ZodLazy = class extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var ZodLiteral = class extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
var ZodEnum = class _ZodEnum extends ZodType {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var ZodPromise = class extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var ZodEffects = class extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
};
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var ZodOptional = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var ZodNullable = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var ZodDefault = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var ZodCatch = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var ZodNaN = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
};
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = /* @__PURE__ */ Symbol("zod_brand");
var ZodBranded = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline = class _ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new _ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
var ZodReadonly = class extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: ((arg) => ZodString.create({ ...arg, coerce: true })),
  number: ((arg) => ZodNumber.create({ ...arg, coerce: true })),
  boolean: ((arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  })),
  bigint: ((arg) => ZodBigInt.create({ ...arg, coerce: true })),
  date: ((arg) => ZodDate.create({ ...arg, coerce: true }))
};
var NEVER = INVALID;

// src/server/schemas/settings.ts
var ruleLoadingTier = external_exports.enum(["minimal", "balanced", "full", "custom"]);
var disciplineProfile = external_exports.enum(["auto", "off", "essential", "full"]);
var enforcementMode = external_exports.enum(["advisory", "hard-stop"]);
var autonomyMode = external_exports.enum(["on", "off", "auto"]);
var userType = external_exports.enum(["", "consultant", "creator", "developer", "finance", "founder", "gtm", "ops"]);
var profileId = external_exports.enum(["developer", "content_creator", "founder", "agency", "finance", "ops"]);
var accessStyle = external_exports.enum(["getters_setters", "get_attribute", "magic_properties"]);
var chatFreq = external_exports.enum(["per_turn", "per_phase", "per_tool"]);
var qualityCadence = external_exports.enum(["end_of_roadmap", "per_phase", "per_step"]);
var regenCadence = external_exports.enum(["per_step", "every_5_steps", "phase_boundary"]);
var fidelityMode = external_exports.enum(["strict", "structural", "hard-floor"]);
var crossSourceMode = external_exports.enum(["on", "auto", "off"]);
var richSkillsMode = external_exports.enum(["on", "ask", "off"]);
var replyMethod = external_exports.enum(["replies_endpoint", "create_review_comment", "auto"]);
var confidenceBand = external_exports.enum(["off", "low", "medium", "high"]);
var onBlock = external_exports.enum(["stop", "ask", "warn"]);
var onBlockFallback = external_exports.enum(["stop", "warn"]);
var modelAutoSwitch = external_exports.enum(["auto", "suggest", "off"]);
var leanProjectionMode = external_exports.enum(["eager-all", "thin"]);
var projectionMode = external_exports.enum(["legacy-all", "scoped"]);
var memoryCadence = external_exports.enum(["auto", "always", "never"]);
var projectAudience = external_exports.enum(["self", "internal", "client", "public"]);
var settingsSchema = external_exports.object({
  agent_config_version: external_exports.string().default("").describe(
    'Pin the package to an exact semver (e.g. "1.4.2") so all teammates load the same skill / rule set. Leave empty to track whatever is installed locally \u2014 useful for the maintainers of this package, risky for production projects.'
  ),
  profile: external_exports.object({
    id: profileId.default("developer").describe(
      "Which experience you run \u2014 the audience identity that selects your default skill / command surface, README entry-path, and persona pre-selection (ADR-010, docs/contracts/profile-system.md). Six seed profiles: developer \xB7 content_creator \xB7 founder \xB7 agency \xB7 finance \xB7 ops. This is the first wizard question. In 6.0.0-A it records the choice only; pack-scoped surfacing (projection-time filtering, ADR-040) activates in 6.0.0-B behind a staged, opt-in rollout. Switch later with `agent-config use --profile=<id>`."
    )
  }).default({ id: "developer" }),
  projection: external_exports.object({
    mode: projectionMode.default("legacy-all").describe(
      "Whether the per-tool projector writes EVERY artefact into the host-tool trees (.claude/ .cursor/ .windsurf/) or only the active profile + packs' artefacts (ADR-040, docs/contracts/capability-packs.md). legacy-all = (default, non-breaking) project the full surface exactly as 5.x did. scoped = project only the active profile's packs unioned with the runtime.active_packs overlay, expanded over the requires graph \u2014 opt in with `agent-config use --profile=<id>`. A failed scoped projection restores the full tree."
    ),
    rule_workspaces: external_exports.array(external_exports.string()).default([]).describe(
      "Workspace scope for the RULE layer only (road-to-request-scoped-rule-load P1/P1b, opt-in). Absent or empty = legacy-all: every rule projects AND installs. Non-empty = only rules whose workspaces frontmatter intersects this list are projected (condense) and installed (install.sh + global wizard payload). Kernel rules always ship; untagged rules fail safe. The default flip to a scoped value is a HUMAN release gate \u2014 do not set this from automation."
    ),
    rule_packs: external_exports.union([external_exports.literal("auto"), external_exports.array(external_exports.string())]).default([]).describe(
      'Optional second scoping axis for the RULE layer, per pack ids (src/config/discovery/packs.yml). When set, a non-kernel rule also needs a packs frontmatter intersection to ship \u2014 e.g. deselecting frontend-design drops ui-audit-gate + design-fidelity. Same opt-in / human-gate semantics as rule_workspaces. The literal "auto" derives the id list from the active-pack set (the same set the skill/command prune uses), so a domain safety floor stops shipping into installs that do not have the pack it guards; an explicit list stays supported and wins over the derivation.'
    )
  }).default({ mode: "legacy-all" }),
  rule_loading_tier: ruleLoadingTier.default("balanced").describe(
    "Master switch for which rule tiers load and how cautiously the agent spends tokens. minimal = only the 9 kernel rules (cheapest, fewest guardrails). balanced = kernel + tier-1 (recommended default). full = kernel + tier-1 + tier-2 (most guardrails, highest token cost). custom = roll your own in agents/overrides/. LEGACY: superseded by discipline_profile \u2014 when that key is set it wins (mapping: minimal\u2192off, balanced\u2192essential, full\u2192full)."
  ),
  discipline_profile: disciplineProfile.optional().describe(
    "The ONE runtime knob for the discipline-rule tier (successor of rule_loading_tier; council 2026-07-07). off = kernel only (~1x tokens). essential = kernel + the measured lift-carrying rules (~3.3x, keeps the weak-host discipline lift). full = everything (~11.7x, EXPERIMENTAL \u2014 residual lift over essential not established). auto = resolve per session against the evidence-gated NULL-lift disable-list in src/config/host-capabilities.yml (measured-null host \u2192 off, otherwise \u2192 essential). Optional and opt-in until the P1/P2 evidence gates pass (agents/roadmaps/road-to-discipline-profile-tiering.md); absent = legacy rule_loading_tier applies."
  ),
  lean_projection: external_exports.object({
    mode: leanProjectionMode.default("eager-all").describe(
      "How the per-tool projector emits the rule layer. eager-all = every rule body inlined into every projection (default, safe). thin = kernel rules full-bodied + non-kernel rules as router-resolved pointers (~45k GPT-tok lighter per session). EXPERIMENTAL: validate with the live A/B before flipping; one-flip revert to eager-all."
    )
  }).default({ mode: "eager-all" }),
  cost: external_exports.object({
    budgets: external_exports.object({
      daily: external_exports.number().min(0).default(0).describe(
        "Daily USD ceiling across all model calls. The agent warns at 50% / 75% / 90% and either stops or warns at 100% depending on cost.enforcement. Set 0 to disable the daily budget entirely."
      ),
      weekly: external_exports.number().min(0).default(0).describe(
        "Rolling 7-day USD ceiling. Same alert ladder as cost.budgets.daily but useful when work bursts unevenly across the week. Set 0 to disable."
      ),
      monthly: external_exports.number().min(0).default(0).describe(
        "Calendar-month USD ceiling. Pairs with cost.enforcement = hard-stop for a hard cap on agent spend before the next billing cycle. Set 0 to disable."
      ),
      per_tier: external_exports.object({
        cheap: external_exports.number().min(0).nullable().default(null).describe(
          "USD ceiling for the cheap model tier. Budget-aware delegation was ARCHIVED 2026-08-16 (docs/contracts/budget-routing.md), so no code routes on this today; the cap is still summed and reported by `budget.mjs tier`. null = no separate tier cap; global ceilings still apply."
        ),
        medium: external_exports.number().min(0).nullable().default(null).describe(
          "USD ceiling for the medium model tier. null = no separate tier cap."
        ),
        strong: external_exports.number().min(0).nullable().default(null).describe(
          "USD ceiling for the strong model tier. null = no separate tier cap. The never-block-to-save-money relation this used to describe went with the archived budget-routing layer (docs/contracts/budget-routing.md); nothing routes between tiers today."
        )
      }).default({ cheap: null, medium: null, strong: null })
    }),
    enforcement: enforcementMode.default("advisory").describe(
      "What happens when a budget hits 100%. advisory = show a banner, keep working (default \u2014 never blocks an active task). hard-stop = refuse further model calls until the budget resets or you raise the ceiling."
    )
  }),
  model: external_exports.object({
    auto_switch: modelAutoSwitch.default("suggest").describe(
      "Per-skill model auto-switch (ADR-035). Skills declare a vendor-neutral model_tier (lite/medium/high); the generator maps it to a native Claude model (high\u2192opus, medium\u2192sonnet, lite\u2192haiku). suggest (default) = never emit a native Claude model: key; the model-recommendation rule names the tier as a one-question suggestion on every surface \u2014 your explicit /model choice is never silently overridden. auto = render a native Claude model: into lite/medium/high-tier skills so Claude Code switches automatically for that turn (reverts next prompt), and suggest on surfaces without a native override. off = inert, no native key and no suggestion."
    )
  }).default({ auto_switch: "suggest" }),
  personal: external_exports.object({
    ide: external_exports.string().default("").describe(
      "CLI binary your IDE registers (code, code-insiders, phpstorm, cursor, windsurf, idea, subl, \u2026). Used by the file-editor skill to open edited files. Leave empty to disable IDE integration."
    ),
    open_edited_files: external_exports.boolean().default(false).describe(
      "After the agent edits a file, run `<ide> <path>` to surface it in your editor immediately. Off by default to avoid window-stealing during long agent runs."
    ),
    rtk_installed: external_exports.boolean().default(false).describe(
      "Does this machine have rtk (Rust Token Killer, a third-party Apache-2.0 tool: https://github.com/rtk-ai/rtk) on PATH \u2014 verified as the real Token Killer, not the unrelated Rust Type Kit that shares the binary name? When true the agent wraps verbose CLI output (git, tests, linters, docker, npm, composer) with rtk (upstream reports 60-90% token savings \u2014 their estimate). Leave false if rtk is missing \u2014 the agent falls back to tail / grep. The wizard overwrites this from a live two-stage probe (PATH presence + `rtk gain` identity check)."
    ),
    minimal_output: external_exports.boolean().default(true).describe(
      "Prefer short bullets and tables (true, default) vs verbose prose with rationale (false). Affects every chat reply; flip to false during debugging when you want the agent to think out loud."
    ),
    canary_name: external_exports.string().default("").describe(
      'Session canary \u2014 the name the agent addresses you with at the start of every new task (e.g. "Alex"). When the greeting silently disappears, the context window is degrading: start a fresh conversation. Also keeps the reply-close markers (end-summary, PR URL as literal last line) alive. Empty = fall back to the user-global canary_name, then to identity.name from the setup wizard; no name anywhere = off. See rules/session-canary.md.'
    ),
    play_by_play: external_exports.boolean().default(false).describe(
      `Narrate intermediate findings between tool calls ("Found it.", "Let me check Y."). Off by default \u2014 most users find it noisy. Turn on when you want to follow the agent's reasoning step by step.`
    ),
    pr_comment_bot_icon: external_exports.boolean().default(false).describe(
      "Prefix every PR review-comment reply with \u{1F916} so humans can tell agent-authored comments apart from teammate comments at a glance. Cosmetic only; the comment body itself never changes."
    ),
    pr_progress_comments: external_exports.boolean().default(false).describe(
      'Permit the agent to post unsolicited progress / status comments on an open PR (e.g. "CI fix iteration #2", "still blocked on workflow scope"). Default off \u2014 most teammates find them noisy. User-invoked flows (/fix:pr-comments, /create-pr, /code-review, explicit "post a comment that \u2026") are NOT gated by this setting. See rules/no-pr-progress-comments.md.'
    ),
    autonomy: autonomyMode.default("auto").describe(
      'How aggressively the agent suppresses trivial workflow questions ("commit now?", "open PR?"). on = silently pick the sensible default. off = always ask. auto (default) = decide per project, on for solo / off when collaborators are involved. The Hard Floor (prod, deploys, bulk deletes) ignores this setting and always asks.'
    ),
    user_type: userType.default("").describe(
      "Optional persona axis used by the skill-suggester to surface the relevant subset (consultant / creator / developer / finance / founder / gtm / ops). Empty = no filter, all skills available. You can change this any time without re-running setup."
    )
  }),
  project: external_exports.object({
    pr_template: external_exports.string().default(".github/pull_request_template.md").describe(
      "Path (relative to project root) to the PR-description template the agent fills in before opening a pull request. Override only if your repo keeps the template somewhere non-standard."
    ),
    upstream_repo: external_exports.string().default("").describe(
      "GitHub slug (owner/repo) the upstream-contribute skill targets when you ask the agent to push a learning back to the shared agent-config package. Empty = improvement PRs are disabled."
    ),
    improvement_pr_branch_prefix: external_exports.string().default("improve/agent-").describe(
      'Branch-name prefix for improvement PRs the agent opens against project.upstream_repo (e.g. "improve/agent-add-react-skill"). Pick a prefix your repo conventions allow.'
    ),
    audience: projectAudience.default("public").describe(
      'Who this project is built for \u2014 read by the demand gate (\xA7 8-pre of docs/guidelines/agent-infra/agent-interaction-and-decision-quality.md), whose L0-L4 ladder measures MARKET demand and is meaningless where no market is intended. self = a tool its maintainer builds for themselves; the gate is inert and work is classified L-self (build) instead of being deferred for lack of a user population nobody wants. internal = a team tool; only "what breaks without it?" survives. client = built for a named client, who is the requester rather than a market segment. public (default) = a product with an intended market; full three-question gate, behaviour unchanged from before this key existed.'
    )
  }),
  github: external_exports.object({
    pr_reply_method: replyMethod.default("create_review_comment").describe(
      "How the agent replies to PR review comments. create_review_comment = post a new review comment (works on every GitHub plan). replies_endpoint = thread the reply under the original comment (needs the newer REST endpoint). auto = detect at runtime, prefer threaded replies when available."
    )
  }),
  augment: external_exports.object({
    rules_use_symlinks: external_exports.boolean().default(false).describe(
      "When true, .augment/rules/*.md are symlinks into dist/agent-src/rules/ \u2014 edits flow back to source on save. When false (default), they are copies \u2014 safer on Windows and shared volumes, but rule edits in .augment/ are lost on the next `task sync`."
    )
  }),
  eloquent: external_exports.object({
    access_style: accessStyle.default("getters_setters").describe(
      'How the agent writes Laravel Eloquent property access. getters_setters = explicit getName() / setName() methods (most refactor-safe). get_attribute = $model->getAttribute("name") (verbose but explicit). magic_properties = $model->name (idiomatic but harder to grep).'
    )
  }),
  chat_history: external_exports.object({
    enabled: external_exports.boolean().default(true).describe(
      "Persist a structured log of every chat turn to .agent-config/chat-history/ so /chat-history:show, :import, and :learn can replay sessions. Turn off if you never want chat transcripts on disk."
    ),
    frequency: chatFreq.default("per_turn").describe(
      "How often the chat-history writer flushes to disk. per_turn = after every user / agent exchange (default, lowest data loss on crash). per_phase = at phase boundaries (cheaper I/O). per_tool = after every tool call (highest fidelity, noisiest log)."
    ),
    text_limits: external_exports.object({
      user: external_exports.number().int().min(0).default(0).describe(
        "Per-message character cap for user inputs in the chat-history log. 0 = log verbatim (default). Raise above 0 only if your prompts contain large pasted artefacts you do not want stored."
      ),
      agent: external_exports.number().int().min(0).default(5e3).describe(
        "Per-message character cap for agent replies in the chat-history log. Truncates with an ellipsis past the cap. Lower to shrink history files, raise for long-reasoning replies."
      ),
      tool: external_exports.number().int().min(0).default(200).describe(
        "Per-call character cap for tool input / output blobs in the chat-history log. The default 200 keeps history files compact while preserving enough signal to replay a session."
      ),
      phase: external_exports.number().int().min(0).default(200).describe(
        "Per-marker character cap for phase markers (Phase=Refine, Phase=Plan, \u2026) in the chat-history log. Rarely needs tuning."
      )
    })
  }),
  pipelines: external_exports.object({
    skill_improvement: external_exports.boolean().default(true).describe(
      "After a meaningful task the agent proposes a learning-capture turn (new skill, rule tweak, guideline). Turn off if you find the prompts noisy \u2014 you can still run /memory:promote manually."
    )
  }),
  roadmap: external_exports.object({
    skip_pre_run_gate: external_exports.boolean().default(true).describe(
      'Skip the /roadmap:process-* pre-run confirmation gate. true (default) starts processing immediately and surfaces the resolved config inline; false shows the numbered-options gate and waits. A genuine "which roadmap?" ambiguity always prompts regardless.'
    ),
    quality_cadence: qualityCadence.default("end_of_roadmap").describe(
      "When the agent runs the full quality / test suite during /roadmap:process-* runs. end_of_roadmap = once, after the last step (fastest, default). per_phase = after each phase boundary. per_step = after every single step (slowest, highest confidence)."
    ),
    dashboard_regen_cadence: regenCadence.default("every_5_steps").describe(
      "How often the agent regenerates agents/roadmaps/dashboard.md during a roadmap run. every_5_steps = batch the regen (default). per_step = after every step (freshest dashboard, highest subprocess overhead). phase_boundary = only at phase edges. A rename, phase add, or archive always regenerates immediately regardless."
    ),
    horizon_weeks: external_exports.number().int().min(0).default(0).describe(
      'Optional planning horizon (weeks) the agent shows in roadmap framing ("next 4 weeks"). Set 0 to omit the horizon \u2014 most teams prefer to ship without a hardcoded window.'
    ),
    gate_budget: external_exports.object({
      max_cost_per_run_usd: external_exports.number().min(0).default(5).describe(
        "Per-run USD ceiling for a CLASS-1 roadmap blocker executed via `agent-config gates --execute`. A class-1 entry whose **Budget:** field states a larger figure renders its consent line instead of running. Bounds the size of an authorised spend; never supplies the authorisation \u2014 `--confirm` is still required on every class-1 run."
      ),
      max_cost_per_rolling_7d_usd: external_exports.number().min(0).default(25).describe(
        "Rolling 7-day USD ceiling for class-1 gate execution, summed from the append-only receipt ledger at agents/runtime/state/gate-budget-ledger.jsonl. A run whose estimate would cross it renders instead of running. A per-run cap alone bounds one mistake, not a week of them, which is why option (a) of b-gate-budget-preauth carries two numbers."
      )
    }).default({ max_cost_per_run_usd: 5, max_cost_per_rolling_7d_usd: 25 })
  }),
  planning: external_exports.object({
    challenge_on_create: external_exports.boolean().default(true).describe(
      "Gate C \u2014 plan-confidence gate before authoring. true (default) = a plan-artifact ask (/roadmap:create, roadmap-writing, /feature:plan, /feature:roadmap) first checks the four 95%-confidence conditions from /challenge-me vision; any gap routes into the interview (or the inline degrade protocol) before authoring, and a confident pass emits exactly one marker line. false = inert, plan asks author directly. An explicit user bypass always wins for that turn and is counted."
    ),
    risk_review: external_exports.boolean().default(true).describe(
      'Gate R1 \u2014 plan-risk review. true (default) = every ready (non-draft) plan must carry a schema-valid "## Risk Register" section (ranked risks, mitigation + anchor per row, freshness marker, exact honest-null grammar), enforced by lint_plan_risk_register at pre-push + CI. false = escape hatch, the validator skips.'
    ),
    completion_review: external_exports.boolean().default(true).describe(
      "Gate R2 \u2014 completion review at 100% roadmap completion / pre-PR. true (default) = a findings-before-fixes review by a fresh reviewer context must exist for the current diff hash (or an exact honest-null / skip declaration) before fix commits and PR creation, enforced by check_completion_review at pre-push + CI (CI authoritative; a crashed validator warns and allows). false = escape hatch, the validator skips."
    )
  }).default({}),
  quality: external_exports.object({
    local_auto_run: external_exports.boolean().default(false).describe(
      "Run quality tools (linters, type-checks, formatters) and the local test suite autonomously after edits. Off by default \u2014 the agent never runs quality tools proactively and does not ask; the user runs them manually (e.g. /quality-fix) and remote CI is the authoritative gate. The agent only runs a quality tool on an explicit ask, a concrete CI failure, or the new-gate carve-out. Turn on to restore autonomous pipeline runs."
    )
  }),
  design: external_exports.object({
    fidelity_mode: fidelityMode.default("strict").describe(
      "How strictly the agent must follow a user-provided prototype / mockup / design system (consumed by the design-fidelity rule). strict = build 1:1, every visible deviation needs confirmation; structural = structure locked, silent gaps fillable with a stated assumption; hard-floor = any deviation is never autonomous."
    )
  }).default({ fidelity_mode: "strict" }),
  consistency: external_exports.object({
    cross_source: crossSourceMode.default("on").describe(
      "Consumed by the cross-source-consistency rule. When the agent works from multiple sources (ticket text, an attached image/mockup, the spec, the codebase) it checks them against each other and asks before proceeding on a discrepancy \u2014 instead of silently guessing. on (default) = surface every real cross-source contradiction / silent-scope-expansion as one question; auto = surface only high-confidence contradictions, state low-confidence as an assumption; off = no cross-source checking."
    )
  }).default({ cross_source: "on" }),
  screenshots: external_exports.object({
    identity_allowlist: external_exports.array(external_exports.string()).default([]).describe(
      "Consumed by the doc-screenshot-hygiene rule and screenshot-hygiene skill. Public identity tokens SAFE to show unredacted in a documentation screenshot \u2014 the maintainer's own public handles plus well-known fake-data tokens. Not a general fake-data dictionary and not identity-resolution: everything not listed is treated as sensitive by default, and a public handle co-located with a real name does not whitelist the real name. Default [] = nothing auto-allowed."
    ),
    forbid_terminal_capture: external_exports.boolean().default(true).describe(
      "Consumed by the doc-screenshot-hygiene rule. true (default) = terminal/CLI/IDE screenshots are forbidden (highest leak vector: absolute local paths, env tokens); use text code blocks with text redaction instead. false = allowed, still subject to the data-bearing human gate."
    ),
    data_bearing_gate: external_exports.enum(["on", "off"]).default("on").describe(
      "Consumed by the doc-screenshot-hygiene rule. on (default) = a data-bearing screenshot embed is gated behind this-turn human confirmation; uncertain/unresolved regions redact-or-refuse, never ship-and-hope; illustrative/no-data screenshots may embed with a stated justification. off = no data-bearing gate (the anonymization taxonomy still applies)."
    )
  }).default({ identity_allowlist: [], forbid_terminal_capture: true, data_bearing_gate: "on" }),
  telegraph: external_exports.object({
    speak: external_exports.boolean().default(false).describe(
      "Whether the telegraph-speak rule ships at all. false (default) = DORMANT: compile_router omits the rule from dist/router.json entirely, so its body never reaches a host. This is the only lever that stops the cost. Set true only after an output-side bench clears the kill-criterion bar (docs/adrs/telegraph/0002)."
    )
  }).default({ speak: false }),
  tokens: external_exports.object({
    rich_skills: richSkillsMode.default("on").describe(
      "Whether skills marked token_budget_class: rich may load in full (exempt from telegraph-speak + thin-projector trimming), consumed by the token-budget-discipline rule. on = allowed (default); off = fall back to standard condensed behavior; ask = surface an estimated token delta (tokens, not dollars) and ask once per session before loading."
    )
  }).default({ rich_skills: "on" }),
  verbosity: external_exports.object({
    intent_announcements: external_exports.boolean().default(false).describe(
      'Intent narration before tool batches ("Let me check X\u2026"). Only honored when personal.play_by_play is ALSO true (the direct-answers narration carve-out requires both). false (default) = act and emit the result.'
    ),
    preview_artifacts: external_exports.boolean().default(false).describe(
      "Show generated commit messages, PR titles/bodies, branch names before acting. false (default) = use generated content directly (/commit terse path)."
    ),
    routine_confirmations: external_exports.boolean().default(false).describe(
      "Confirmation prompts for routine workflow steps with one obvious answer. Iron-Law gates (commit-policy, scope-control git-ops, Hard Floor) ALWAYS ask regardless."
    ),
    offer_council_in_delivery: external_exports.boolean().default(false).describe(
      'Offer "run AI Council on this?" inside delivery commands (/feature-plan, /review-changes, /roadmap-create). Council commands themselves are unaffected.'
    ),
    post_action_reports: external_exports.enum(["off", "minimal", "full"]).default("minimal").describe(
      "Status blocks after a successful action. off = errors only; minimal (default) = one-line confirmation; full = bullet list."
    )
  }).default({
    intent_announcements: false,
    preview_artifacts: false,
    routine_confirmations: false,
    offer_council_in_delivery: false,
    post_action_reports: "minimal"
  }),
  code_style: external_exports.object({
    docblocks: external_exports.enum(["minimal", "full"]).default("minimal").describe(
      "Consumed by the code-comment-discipline rule. minimal (default) = no signature-mirroring docblocks; docblocks only for machine-relevant precision (generics, array shapes) or genuine why-context. full = the exported public surface of a library package may carry one-line summary docblocks; the redundancy ban still holds."
    )
  }).default({ docblocks: "minimal" }),
  reasoning: external_exports.object({
    enabled: external_exports.boolean().default(true).describe(
      "Master switch for the Reasoning Discipline Protocol (RDP). false = the whole layer is inert (zero overhead)."
    ),
    auto_gate: external_exports.boolean().default(true).describe(
      "Engage the discipline only where it pays, using table-free signals (task triviality + agent-self-assessed host reasoning strength; no runtime model->band lookup, per ADR-035). false = gate on task-signal + the component toggles only."
    ),
    components: external_exports.object({
      orchestrator: external_exports.boolean().default(true).describe(
        "Sequence the reasoning chain (ground->intent->notes->gather->audit->verify) as one system; the single coordination point."
      ),
      notes_first: external_exports.boolean().default(true).describe(
        "Keep hypotheses/predictions/decisions in session notes; the response carries conclusions + evidence only."
      ),
      grounding: external_exports.boolean().default(true).describe(
        "Explore the environment / close info-gaps before designing."
      ),
      intent: external_exports.boolean().default(true).describe(
        "Infer the underlying goal before solving the literal ask (standard host only)."
      ),
      complexity_first: external_exports.boolean().default(true).describe(
        "Risk-first: resolve the load-bearing unknown before the easy parts (RDP derivation, not a Fable-documented behavior)."
      ),
      verifier_default: external_exports.boolean().default(true).describe(
        "Run a fresh-context verifier on the structural-complexity gate (branching/constraints/stateful/irreversible + token floor)."
      ),
      prediction_tracking: external_exports.boolean().default(true).describe(
        "Log prediction + confidence + outcome + lesson (calibration loop)."
      ),
      decision_ledger: external_exports.boolean().default(true).describe(
        "Log decision + alternatives + reason + revisit-if; escalates to decision-record/ADR when durable."
      ),
      uncertainty_budget: external_exports.boolean().default(true).describe(
        "Per-dimension uncertainty score that feeds adaptive effort."
      )
    }).default({})
  }).default({}),
  subagents: external_exports.object({
    downshift: external_exports.boolean().default(true).describe(
      "Route delegable sub-tasks to the lowest-capable model tier (cost + speed via model downshift). false = every subagent runs on the session tier."
    ),
    quota_arbitrage: external_exports.boolean().default(true).describe(
      "Prefer a separate quota-pool model for delegable sub-tasks where the host manifest reports one. Optional bonus only \u2014 identical behaviour (minus the quota win) where unsupported. Never load-bearing."
    ),
    model_map: external_exports.object({
      lite: external_exports.string().default("").describe("Model alias for lite-tier sub-tasks. Empty = the tier runtime default."),
      medium: external_exports.string().default("").describe("Model alias for medium-tier sub-tasks. Empty = the tier runtime default."),
      high: external_exports.string().default("").describe("Model alias for high-tier sub-tasks. Empty = the tier runtime default.")
    }).default({}).describe(
      "Per-tier model map for downshift routing. Each empty value uses the tier runtime default (no vendor model baked in)."
    ),
    implementer_model: external_exports.string().default("").describe(
      "Override the model the orchestrator dispatches to subagents that write code (e.g. claude-sonnet-4, gpt-5). Empty (default) = inherit the session's primary model \u2014 cheapest and usually right."
    ),
    judge_model: external_exports.string().default("").describe(
      "Override the model used for review / judge subagents that critique implementer output. Empty (default) = one tier above the implementer model \u2014 picks up nuance the implementer missed."
    ),
    model_ceiling: external_exports.string().default("").describe(
      "Session-wide model CEILING for subagents (spend cap). Empty (default) = no ceiling. When set, suite-owned CLI spawn wrappers export CLAUDE_CODE_SUBAGENT_MODEL to the sessions they launch. Class C: a human sets it; the agent never writes or infers one."
    ),
    max_parallel: external_exports.number().int().min(1).default(3).describe(
      "Hard cap on subagents running in parallel during /do-in-parallel, /do-competitively, and /judge runs. Raise for faster fan-out, lower if you hit rate limits or want lower token spend."
    ),
    adversarial_council: external_exports.enum(["off", "ask", "on"]).default("off").describe(
      "Opt-in adversarial-verification-council mode (subagent-orchestration Mode 9, ADR-122). off (default) = never runs; ask = offer it on an explicit high-risk change; on = auto-run on high-risk changes. Advisory only \u2014 a panel of distinct-model skeptics red-teams a real change for defect FINDING coverage and NEVER auto-gates it (Hard Floor). Stays default-off until the adversarial-council-finding-coverage claim is backed."
    )
  }),
  // `worktrees.mode` was DELETED (ADR-229). Worktree creation is
  // instruction-only and hardcoded; there is nothing left to configure. A
  // leftover key is ignored with one deprecation line via REMOVED_KEYS.
  ai_team: external_exports.object({
    model: external_exports.string().default("auto").describe(
      "Model handed to the codex CLI. 'auto' (default) = pass no --model flag so the CLI's own default applies \u2014 tracks the subscription's current strongest model instead of pinning a stale ID. Any other value passes through verbatim as `--model <value>`."
    ),
    allow_delegate: external_exports.boolean().default(false).describe(
      "Second opt-in for the only wrapper that delegates write access (/team:delegate). false (default) = delegate refuses even when /team itself is available. Availability (codex CLI installed + authenticated) is necessary but not sufficient \u2014 this key must ALSO be true before delegation is reachable."
    ),
    max_calls_per_day: external_exports.number().int().min(0).default(50).describe(
      "Per-day cap on team calls, read against the EXISTING cli_call_budget openai bucket (~/.event4u/agent-config/cli-calls.json, daily UTC reset) \u2014 one subscription, one counter, never a parallel count. 0 = block all team calls."
    ),
    suppress_setup_hint: external_exports.boolean().default(false).describe(
      "Suppress the one-line wizard/init recommendation to set up the codex plugin on Claude-Code hosts. Cosmetic only \u2014 never changes behavior."
    ),
    review_gate: external_exports.object({
      managed: external_exports.boolean().default(false).describe(
        "Managed governance of the codex plugin's Stop-hook Review Gate (road-to-team-mode Phase 4). false (default) = byte-identical pre-Phase-4 behavior: no counting, no circuit breaker. true = count consecutive BLOCK verdicts per session and trip the circuit breaker at max_consecutive_blocks."
      ),
      max_consecutive_blocks: external_exports.number().int().min(1).default(3).describe(
        "Circuit-breaker bound: after this many CONSECUTIVE BLOCK verdicts in one session, a visible notice is injected exactly once and the managed layer stops re-blocking \u2014 the user decides, never an infinite Claude\u2194Codex loop. An ALLOW verdict resets the counter. Positive integer."
      )
    }).default({ managed: false, max_consecutive_blocks: 3 })
  }).default({ model: "auto", allow_delegate: false, max_calls_per_day: 50, suppress_setup_hint: false, review_gate: { managed: false, max_consecutive_blocks: 3 } }),
  emergency: external_exports.object({
    orchestration_halt: external_exports.boolean().default(false).describe(
      "The one audited incident switch over the always-on orchestration stack (subagents, council, team). NOT an activation gate: false (default) = the stack runs normally. true = halted; arming requires no ceremony. Disarming (returning to false) requires orchestration_halt_justification to be a non-empty string. Both transitions emit one telemetry line."
    ),
    orchestration_halt_justification: external_exports.string().default("").describe(
      "Required non-empty before orchestration_halt may return to false. Ignored while arming the halt."
    )
  }).default({ orchestration_halt: false, orchestration_halt_justification: "" }),
  onboarding: external_exports.object({
    onboarded: external_exports.boolean().default(false).describe(
      "Set to true once the developer has completed `agent-config setup`. The onboarding-gate rule blocks the first turn of every chat until this is true. Toggle back to false to re-trigger the wizard."
    )
  }),
  commands: external_exports.object({
    auto_detect: external_exports.enum(["enabled", "warn", "disabled"]).default("enabled").describe(
      "Global kill-switch for orchestrator auto-detection (6.1.0 non-interactive-contract). enabled (default) = /judge, /fix, /analytics, /tests, /override auto-detect their sub-command per a confidence-tiered table; warn = detect but always confirm before routing; disabled = never auto-detect (always show the menu interactively, require an explicit sub-command in CI). Per-orchestrator override: auto_detect:false in front-matter. Per-invocation: --no-auto-detect."
    ),
    suggestion: external_exports.object({
      enabled: external_exports.boolean().default(true).describe(
        'Master switch for the slash-command suggestion layer. When on, the agent offers numbered options ("did you mean /commit?") instead of guessing. Turn off if you prefer to type every command yourself.'
      ),
      confidence_floor: external_exports.number().min(0).max(1).default(0.6).describe(
        "Minimum semantic-match score (0.0\u20131.0) before a command is offered as a suggestion. 0.6 (default) balances precision and recall. Raise toward 0.8 for fewer false positives, lower for broader hints."
      ),
      cooldown_seconds: external_exports.number().int().min(0).default(600).describe(
        "How long (seconds) the suggester waits before offering the same command again after you ignored it. Default 600s (10 min) keeps the agent from nagging. Set 0 to disable the cooldown."
      ),
      max_options: external_exports.number().int().min(0).default(4).describe(
        'Maximum number of command suggestions shown in a single numbered-options block, before the "Proceed as-is" escape. Lower for terser prompts, raise if you regularly want broader fan-out.'
      ),
      blocklist: external_exports.array(external_exports.string()).default([]).describe(
        'Slash-command names that should never be suggested, one per line (e.g. "commit", "create-pr"). Useful if a command misfires on your common phrasing.'
      )
    }),
    create_pr: external_exports.object({
      preview_description: external_exports.boolean().default(false).describe(
        "When /create-pr runs, show the generated title and body and wait for confirmation before opening the PR. Off by default (zero-friction PR creation); turn on if you want a last-look gate."
      ),
      detail_level: external_exports.enum(["min", "med", "max"]).default("min").describe(
        "Verbosity tier for the generated PR description body. min (default) = title + 2-3 sentence what/why/impact + linked ticket (token-frugal); med = min + grouped changes + tests note; max = med + how-to-test + edge cases + reviewer guidance. Critical info (breaking changes, migrations, security, rollback) is ALWAYS included at every tier \u2014 the tier governs explanatory depth, never whether a critical callout appears."
      ),
      api_examples: external_exports.boolean().default(true).describe(
        "JSON request/response examples for API-endpoint changes. true (default) = include a fenced example ONLY when grounded in a real source (response DTO/resource, OpenAPI/schema, test fixture, or an actual probe); no grounded source \u2192 a one-line pointer, never an invented example. false = never add API examples."
      ),
      screenshots: external_exports.boolean().default(false).describe(
        "Screenshots for frontend changes. false (default) = never attempt. true = attempt when the host has browser/preview tooling and the diff touches a frontend surface; capability-gated (emits a one-line note and leaves the placeholder when tooling is absent, never fails or blocks the PR). Before/after + changed-region highlighting is best-effort."
      ),
      ui_paths: external_exports.array(external_exports.string()).default([]).describe(
        'Optional glob list that makes frontend detection explicit instead of heuristic (e.g. ["resources/views/**", "src/pages/**"]). Empty (default) = a light path/extension heuristic that fails open (no false enrichment when the surface is ambiguous).'
      ),
      api_paths: external_exports.array(external_exports.string()).default([]).describe(
        'Optional glob list that makes API-endpoint detection explicit instead of heuristic (e.g. ["app/Http/Controllers/Api/**", "src/pages/api/**"]). Empty (default) = a light path/extension heuristic that fails open.'
      )
    })
  }),
  memory: external_exports.object({
    cadence: memoryCadence.default("always").describe(
      "Cadence of the \u{1F9E0} memory-visibility line after a memory-consulting step. always (default) = show whenever a memory type was asked; auto = show only when 3+ types were consulted (less noise); never = suppress. Distinct from rule_loading_tier \u2014 owns its own key since the 2026-06-01 untangle."
    ),
    review_threshold: external_exports.number().int().min(0).default(10).describe(
      "Maximum number of memory entries /memory:load surfaces inline before falling back to a summary view. Default 10 keeps the chat readable. Raise to see more candidates, lower to keep the context tight."
    ),
    redact_patterns: external_exports.array(external_exports.string()).default([]).describe(
      "Regex patterns (one per line) that scrub matches from chat-history transcripts and memory before they hit disk. Use for secrets, customer names, internal URLs. Patterns are anchored and case-insensitive."
    ),
    session_index: external_exports.enum(["on", "off"]).default("off").describe(
      "Opt-in compact memory index at session start (road-to-memory-retrieval-economy P5). on = inject a compact id + title + ~tokens index of curated entries (hard cap 30 rows, bodies never included) through the hot-context hook; the agent fetches full entries via memory_get on demand. off (default) = no injection \u2014 the ship-criterion (measured hit-rate gain) is unproven, so off unless proven."
    ),
    learn_on_session_end: external_exports.boolean().default(false).describe(
      "session_end learning-sidecar aggregation (road-to-reachable-code-memory P4). true = the session_end hook aggregates agents/memory/intake/*.jsonl through the learning sidecar into the gitignored .agent-learning.json + LESSONS.md (local-only, 2 s budget, fail-open; promotion stays human via /memory:propose). false (default, council 2026-07-27) = no-op; the flip is proposed only after the 30-day dogfood shows non-trivial signal AND session-end p95 < 2 s."
    )
  }),
  knowledge: external_exports.object({
    global_sharing: external_exports.object({
      enabled: external_exports.boolean().default(true).describe(
        "Master switch for the file-first global knowledge-card store (ADR-100; default-ON per ADR-119, the validated bounded-downside flip superseding ADR-103 \u2014 write-time redaction incl. hidden-unicode hardening, narrowest tier default, pre-registered demotion trigger). User-global setting \u2014 keep in ~/.event4u/agent-config/agent-settings.yml. false fully no-ops the layer (single-key revert); project-local cards (v1) are unaffected."
      ),
      allowed_tiers: external_exports.array(external_exports.string()).default(["public"]).describe(
        "Origin tiers auto-eligible to cross a project boundary. proprietary is manual-only regardless (the gate hard-codes it), so an in-house schema never auto-shares."
      ),
      redaction: external_exports.object({
        enabled: external_exports.boolean().default(true).describe(
          "Run the privacy-floor + source-confidentiality scan before any card goes global."
        ),
        halt_on_trigger: external_exports.boolean().default(true).describe(
          "Halt-and-surface on a confidential-pattern hit; never silent-share, never auto-rewrite."
        )
      }).default({}),
      auto_promote_threshold: external_exports.number().int().min(1).default(2).describe(
        "Distinct-repo count at which a public/vendor card triggers a promotion suggestion (never a silent write)."
      ),
      freshness: external_exports.object({
        hypothesis_after_days: external_exports.number().int().min(0).default(90).describe(
          "A global card older than this is lead-only (positive structure must be re-confirmed before use)."
        ),
        stale_after_days: external_exports.number().int().min(0).default(180).describe(
          "A global card older than this is skipped until re-verified."
        )
      }).default({})
    }).default({})
  }).default({}),
  hooks: external_exports.object({
    concern_budget: external_exports.object({
      max_per_event: external_exports.number().int().min(1).default(8).describe(
        "Maximum number of concerns (issues / warnings) a single hook may raise per (platform, event) pair before the hook is rate-limited. Default 8 prevents noisy hooks from drowning out high-signal ones."
      ),
      tier1_concerns: external_exports.array(external_exports.string()).default([]).describe(
        "Concern IDs (one per line) that are allowed to block the run on failure rather than warn. Reserved for high-confidence guards \u2014 leave empty unless you maintain custom hooks."
      ),
      hard_fail: external_exports.boolean().default(false).describe(
        "When a hook exceeds hooks.concern_budget.max_per_event, fail the run (true) instead of warning and continuing (false, default). Turn on in CI when you want hook quality to gate merges."
      )
    }),
    injection_scan: external_exports.object({
      enabled: external_exports.boolean().default(false).describe(
        "PostToolUse prompt-injection scanner (road-to-security-pillar.md P3.2). Default off. When on, scans tool output (file reads, web fetches, MCP responses) for injection signatures and WARNS in context (never blocks). Runtime backstop on top of the always-on untrusted-input-defense rule; detection is probabilistic."
      )
    }).default({}),
    rtk_wrap: external_exports.object({
      enabled: external_exports.boolean().default(false).describe(
        'PreToolUse RTK-wrap nudge (token-saving Phase 3). Default off. When on AND the binary on PATH is verified as Rust Token Killer (a live two-stage identity probe \u2014 not a self-reported flag, and never a colliding same-name binary), warns (never blocks) "re-run wrapped with rtk" before a single verbose CLI command (git/npm/cargo/docker/\u2026) \u2014 upstream reports 60\u201390% output-token savings (their estimate). Skips completeness-critical / piped / compound commands and git diff. No-op when rtk is absent, unverified, or a different tool.'
      )
    }).default({}),
    design_slop: external_exports.object({
      enabled: external_exports.boolean().default(false).describe(
        "PreToolUse anti-slop nudge (road-to-anti-slop-detector Phase 3). Default off. When on, runs the lint_design_slop registry against about-to-be-written UI content and WARNS (never blocks) on P0/P1 aesthetic tells (side-stripe, gradient-text, magic z-index, \u2026). Flags are rebuttable via DESIGN.md / design-slop-disable. Anti-loop: a file::rule signature surfaced 3x goes silent. Host-limited convenience layer; the universal gate is the lint_design_slop linter/CI."
      )
    }).default({}),
    design_pass: external_exports.object({
      enabled: external_exports.boolean().default(false).describe(
        "PostToolUse + stop design pass (road-to-frontend-power E1.1/E1.2/E1.3). Default off. One concern on two slots: on post_tool_use a write to a UI surface delivers the design findings as context and never blocks; on stop the same pass runs over every UI file touched this session, deduped against what the post pass surfaced, and a P0 objective floor (contrast, font size, heading skip, focus) blocks with a continuation. P1-P3 never block. post_tool_use rather than pre_tool_use for two measured reasons: pre_tool_use is declared by three hosts and honoured by one while post_tool_use is declared by six, and _lib/ui_surface.ts is a path predicate, so a pre-write gate cannot fire on the first write of a new surface. A pass that could not fully run reports verification: degraded with a reason rather than passing silently. Does not replace design_slop: two design keys is the honest state until the tiering experiment has a number."
      )
    }).default({}),
    ui_route_nudge: external_exports.object({
      enabled: external_exports.boolean().default(false).describe(
        "PreToolUse UI-route nudge (road-to-frontend-skill-application Phase 4). Default off. When on, a Write/Edit to a UI surface with no design consultation latched this session WARNS (never blocks) naming the route \u2014 run existing-ui-audit, then the fe-design loop. A read or search touching fe-design / existing-ui-audit / design-review / design-intelligence latches consultation and silences it for the session. Anti-loop: at most 2 nudges per session. It does not read the rules: the UI-surface decision comes from _lib/ui_surface.ts and no code parses rule frontmatter, so this runs parallel to the two UI rules rather than consuming their triggers, and a test keeps the sets from drifting. It is a nudge, so their enforced_by: none stays accurate."
      )
    }).default({}),
    code_graph: external_exports.object({
      enabled: external_exports.boolean().default(false).describe(
        "PreToolUse code-graph nudge (ADR-124 Phase 4). Default off. When on AND a native code-graph cache or a consumer-shipped graph.json/SCIP index is present, warns once per session (never blocks) as the agent is about to Grep/Glob or Read a source file \u2014 query the graph first for who-calls/where-used/impact questions (or rebuild if stale, build if absent). Source G\u2019s strict block-first-read mode is deliberately un-ported."
      )
    }).default({})
    // `turn_end_gate` is deliberately ABSENT. The stop-slot turn-end gate is
    // always armed (2026-08-12) and has no settings surface: whether it
    // fires is decided by each detector's own trigger conditions, not by a
    // flag. A leftover `hooks.turn_end_gate.*` block from an older install
    // warns once on stderr and is ignored — see REMOVED_KEYS in
    // `src/scripts/_lib/agent_settings.ts`.
  }),
  decision_engine: external_exports.object({
    surface_traces: external_exports.boolean().default(false).describe(
      "Emit DecisionTraceHook events that surface why the agent picked one option over another. Useful when debugging unexpected choices; off by default to keep chat noise low."
    ),
    min_confidence: confidenceBand.default("off").describe(
      "During Phase=Plan, refuse to advance to Phase=Implement if confidence is below this band. off (default) = no gate. low / medium / high = raise the floor; on miss, decision_engine.on_block decides what happens."
    ),
    block_on_risk: confidenceBand.default("off").describe(
      "During Phase=Implement, refuse to act when the risk class meets or exceeds this band. off (default) = no gate. low / medium / high = stricter ceilings; pairs with decision_engine.on_block."
    ),
    require_memory_hits: external_exports.boolean().default(false).describe(
      "During Phase=Refine, require at least one relevant memory hit (skill, ADR, past decision) before the agent proceeds. Off by default; turn on for highly conventional codebases where memory should always inform decisions."
    ),
    on_block: onBlock.default("stop").describe(
      "What the decision engine does when a gate (min_confidence / block_on_risk / require_memory_hits) fires. stop (default) = halt and surface the reason. ask = present numbered options. warn = log and continue."
    ),
    ask_timeout_seconds: external_exports.number().int().min(0).default(30).describe(
      "Non-TTY timeout (seconds) for decision_engine.on_block = ask. After this elapses without input, decision_engine.on_block_fallback takes over. Default 30s; raise for slow human review, 0 = wait forever."
    ),
    on_block_fallback: onBlockFallback.default("stop").describe(
      "Resolution when decision_engine.on_block = ask times out (see decision_engine.ask_timeout_seconds). stop (default) = halt the run. warn = log and continue with the agent's best guess."
    )
  }),
  update_check: external_exports.object({
    enabled: external_exports.boolean().default(true).describe(
      "Once per day the agent checks the npm registry for a newer agent-config release and surfaces a one-line banner if one exists. Turn off in air-gapped environments or to silence the banner."
    )
  }),
  explain: external_exports.object({
    enable_last: external_exports.boolean().default(true).describe(
      "Enable the `agent-config explain last` command, which prints the reasoning behind the agent's most recent decision (last tool call, last suggestion). Disable if you never use it and want a smaller CLI surface."
    )
  }),
  legal_review_prep: external_exports.object({
    acknowledged: external_exports.boolean().default(false).describe(
      "I understand the legal-review-prep pack provides templates and general information ONLY \u2014 it is NOT legal advice, creates no attorney-client relationship, and never replaces a licensed lawyer. Individual cases require an attorney. The pack stays inactive until this is checked."
    ),
    require_council: external_exports.boolean().default(true).describe(
      "Gate legal work-product behind a multi-model AI-council / deep-research pass (defense-in-depth: documented multi-stage review + audit trail; fail-closed when no council is configured). Leave on for the safest posture. Turning it off lets single-model legal output through \u2014 not recommended for a high-risk pack."
    )
  }).default({ acknowledged: false, require_council: true })
});

// node_modules/zod-to-json-schema/dist/esm/Options.js
var ignoreOverride = /* @__PURE__ */ Symbol("Let zodToJsonSchema decide on which parser to use");
var defaultOptions = {
  name: void 0,
  $refStrategy: "root",
  basePath: ["#"],
  effectStrategy: "input",
  pipeStrategy: "all",
  dateStrategy: "format:date-time",
  mapStrategy: "entries",
  removeAdditionalStrategy: "passthrough",
  allowedAdditionalProperties: true,
  rejectedAdditionalProperties: false,
  definitionPath: "definitions",
  target: "jsonSchema7",
  strictUnions: false,
  definitions: {},
  errorMessages: false,
  markdownDescription: false,
  patternStrategy: "escape",
  applyRegexFlags: false,
  emailStrategy: "format:email",
  base64Strategy: "contentEncoding:base64",
  nameStrategy: "ref",
  openAiAnyTypeName: "OpenAiAnyType"
};
var getDefaultOptions = (options) => typeof options === "string" ? {
  ...defaultOptions,
  name: options
} : {
  ...defaultOptions,
  ...options
};

// node_modules/zod-to-json-schema/dist/esm/Refs.js
var getRefs = (options) => {
  const _options = getDefaultOptions(options);
  const currentPath = _options.name !== void 0 ? [..._options.basePath, _options.definitionPath, _options.name] : _options.basePath;
  return {
    ..._options,
    flags: { hasReferencedOpenAiAnyType: false },
    currentPath,
    propertyPath: void 0,
    seen: new Map(Object.entries(_options.definitions).map(([name, def]) => [
      def._def,
      {
        def: def._def,
        path: [..._options.basePath, _options.definitionPath, name],
        // Resolution of references will be forced even though seen, so it's ok that the schema is undefined here for now.
        jsonSchema: void 0
      }
    ]))
  };
};

// node_modules/zod-to-json-schema/dist/esm/errorMessages.js
function addErrorMessage(res, key, errorMessage, refs) {
  if (!refs?.errorMessages)
    return;
  if (errorMessage) {
    res.errorMessage = {
      ...res.errorMessage,
      [key]: errorMessage
    };
  }
}
function setResponseValueAndErrors(res, key, value, errorMessage, refs) {
  res[key] = value;
  addErrorMessage(res, key, errorMessage, refs);
}

// node_modules/zod-to-json-schema/dist/esm/getRelativePath.js
var getRelativePath = (pathA, pathB) => {
  let i = 0;
  for (; i < pathA.length && i < pathB.length; i++) {
    if (pathA[i] !== pathB[i])
      break;
  }
  return [(pathA.length - i).toString(), ...pathB.slice(i)].join("/");
};

// node_modules/zod-to-json-schema/dist/esm/parsers/any.js
function parseAnyDef(refs) {
  if (refs.target !== "openAi") {
    return {};
  }
  const anyDefinitionPath = [
    ...refs.basePath,
    refs.definitionPath,
    refs.openAiAnyTypeName
  ];
  refs.flags.hasReferencedOpenAiAnyType = true;
  return {
    $ref: refs.$refStrategy === "relative" ? getRelativePath(anyDefinitionPath, refs.currentPath) : anyDefinitionPath.join("/")
  };
}

// node_modules/zod-to-json-schema/dist/esm/parsers/array.js
function parseArrayDef(def, refs) {
  const res = {
    type: "array"
  };
  if (def.type?._def && def.type?._def?.typeName !== ZodFirstPartyTypeKind.ZodAny) {
    res.items = parseDef(def.type._def, {
      ...refs,
      currentPath: [...refs.currentPath, "items"]
    });
  }
  if (def.minLength) {
    setResponseValueAndErrors(res, "minItems", def.minLength.value, def.minLength.message, refs);
  }
  if (def.maxLength) {
    setResponseValueAndErrors(res, "maxItems", def.maxLength.value, def.maxLength.message, refs);
  }
  if (def.exactLength) {
    setResponseValueAndErrors(res, "minItems", def.exactLength.value, def.exactLength.message, refs);
    setResponseValueAndErrors(res, "maxItems", def.exactLength.value, def.exactLength.message, refs);
  }
  return res;
}

// node_modules/zod-to-json-schema/dist/esm/parsers/bigint.js
function parseBigintDef(def, refs) {
  const res = {
    type: "integer",
    format: "int64"
  };
  if (!def.checks)
    return res;
  for (const check of def.checks) {
    switch (check.kind) {
      case "min":
        if (refs.target === "jsonSchema7") {
          if (check.inclusive) {
            setResponseValueAndErrors(res, "minimum", check.value, check.message, refs);
          } else {
            setResponseValueAndErrors(res, "exclusiveMinimum", check.value, check.message, refs);
          }
        } else {
          if (!check.inclusive) {
            res.exclusiveMinimum = true;
          }
          setResponseValueAndErrors(res, "minimum", check.value, check.message, refs);
        }
        break;
      case "max":
        if (refs.target === "jsonSchema7") {
          if (check.inclusive) {
            setResponseValueAndErrors(res, "maximum", check.value, check.message, refs);
          } else {
            setResponseValueAndErrors(res, "exclusiveMaximum", check.value, check.message, refs);
          }
        } else {
          if (!check.inclusive) {
            res.exclusiveMaximum = true;
          }
          setResponseValueAndErrors(res, "maximum", check.value, check.message, refs);
        }
        break;
      case "multipleOf":
        setResponseValueAndErrors(res, "multipleOf", check.value, check.message, refs);
        break;
    }
  }
  return res;
}

// node_modules/zod-to-json-schema/dist/esm/parsers/boolean.js
function parseBooleanDef() {
  return {
    type: "boolean"
  };
}

// node_modules/zod-to-json-schema/dist/esm/parsers/branded.js
function parseBrandedDef(_def, refs) {
  return parseDef(_def.type._def, refs);
}

// node_modules/zod-to-json-schema/dist/esm/parsers/catch.js
var parseCatchDef = (def, refs) => {
  return parseDef(def.innerType._def, refs);
};

// node_modules/zod-to-json-schema/dist/esm/parsers/date.js
function parseDateDef(def, refs, overrideDateStrategy) {
  const strategy = overrideDateStrategy ?? refs.dateStrategy;
  if (Array.isArray(strategy)) {
    return {
      anyOf: strategy.map((item, i) => parseDateDef(def, refs, item))
    };
  }
  switch (strategy) {
    case "string":
    case "format:date-time":
      return {
        type: "string",
        format: "date-time"
      };
    case "format:date":
      return {
        type: "string",
        format: "date"
      };
    case "integer":
      return integerDateParser(def, refs);
  }
}
var integerDateParser = (def, refs) => {
  const res = {
    type: "integer",
    format: "unix-time"
  };
  if (refs.target === "openApi3") {
    return res;
  }
  for (const check of def.checks) {
    switch (check.kind) {
      case "min":
        setResponseValueAndErrors(
          res,
          "minimum",
          check.value,
          // This is in milliseconds
          check.message,
          refs
        );
        break;
      case "max":
        setResponseValueAndErrors(
          res,
          "maximum",
          check.value,
          // This is in milliseconds
          check.message,
          refs
        );
        break;
    }
  }
  return res;
};

// node_modules/zod-to-json-schema/dist/esm/parsers/default.js
function parseDefaultDef(_def, refs) {
  return {
    ...parseDef(_def.innerType._def, refs),
    default: _def.defaultValue()
  };
}

// node_modules/zod-to-json-schema/dist/esm/parsers/effects.js
function parseEffectsDef(_def, refs) {
  return refs.effectStrategy === "input" ? parseDef(_def.schema._def, refs) : parseAnyDef(refs);
}

// node_modules/zod-to-json-schema/dist/esm/parsers/enum.js
function parseEnumDef(def) {
  return {
    type: "string",
    enum: Array.from(def.values)
  };
}

// node_modules/zod-to-json-schema/dist/esm/parsers/intersection.js
var isJsonSchema7AllOfType = (type) => {
  if ("type" in type && type.type === "string")
    return false;
  return "allOf" in type;
};
function parseIntersectionDef(def, refs) {
  const allOf = [
    parseDef(def.left._def, {
      ...refs,
      currentPath: [...refs.currentPath, "allOf", "0"]
    }),
    parseDef(def.right._def, {
      ...refs,
      currentPath: [...refs.currentPath, "allOf", "1"]
    })
  ].filter((x) => !!x);
  let unevaluatedProperties = refs.target === "jsonSchema2019-09" ? { unevaluatedProperties: false } : void 0;
  const mergedAllOf = [];
  allOf.forEach((schema) => {
    if (isJsonSchema7AllOfType(schema)) {
      mergedAllOf.push(...schema.allOf);
      if (schema.unevaluatedProperties === void 0) {
        unevaluatedProperties = void 0;
      }
    } else {
      let nestedSchema = schema;
      if ("additionalProperties" in schema && schema.additionalProperties === false) {
        const { additionalProperties, ...rest } = schema;
        nestedSchema = rest;
      } else {
        unevaluatedProperties = void 0;
      }
      mergedAllOf.push(nestedSchema);
    }
  });
  return mergedAllOf.length ? {
    allOf: mergedAllOf,
    ...unevaluatedProperties
  } : void 0;
}

// node_modules/zod-to-json-schema/dist/esm/parsers/literal.js
function parseLiteralDef(def, refs) {
  const parsedType = typeof def.value;
  if (parsedType !== "bigint" && parsedType !== "number" && parsedType !== "boolean" && parsedType !== "string") {
    return {
      type: Array.isArray(def.value) ? "array" : "object"
    };
  }
  if (refs.target === "openApi3") {
    return {
      type: parsedType === "bigint" ? "integer" : parsedType,
      enum: [def.value]
    };
  }
  return {
    type: parsedType === "bigint" ? "integer" : parsedType,
    const: def.value
  };
}

// node_modules/zod-to-json-schema/dist/esm/parsers/string.js
var emojiRegex2 = void 0;
var zodPatterns = {
  /**
   * `c` was changed to `[cC]` to replicate /i flag
   */
  cuid: /^[cC][^\s-]{8,}$/,
  cuid2: /^[0-9a-z]+$/,
  ulid: /^[0-9A-HJKMNP-TV-Z]{26}$/,
  /**
   * `a-z` was added to replicate /i flag
   */
  email: /^(?!\.)(?!.*\.\.)([a-zA-Z0-9_'+\-\.]*)[a-zA-Z0-9_+-]@([a-zA-Z0-9][a-zA-Z0-9\-]*\.)+[a-zA-Z]{2,}$/,
  /**
   * Constructed a valid Unicode RegExp
   *
   * Lazily instantiate since this type of regex isn't supported
   * in all envs (e.g. React Native).
   *
   * See:
   * https://github.com/colinhacks/zod/issues/2433
   * Fix in Zod:
   * https://github.com/colinhacks/zod/commit/9340fd51e48576a75adc919bff65dbc4a5d4c99b
   */
  emoji: () => {
    if (emojiRegex2 === void 0) {
      emojiRegex2 = RegExp("^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$", "u");
    }
    return emojiRegex2;
  },
  /**
   * Unused
   */
  uuid: /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/,
  /**
   * Unused
   */
  ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/,
  ipv4Cidr: /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/,
  /**
   * Unused
   */
  ipv6: /^(([a-f0-9]{1,4}:){7}|::([a-f0-9]{1,4}:){0,6}|([a-f0-9]{1,4}:){1}:([a-f0-9]{1,4}:){0,5}|([a-f0-9]{1,4}:){2}:([a-f0-9]{1,4}:){0,4}|([a-f0-9]{1,4}:){3}:([a-f0-9]{1,4}:){0,3}|([a-f0-9]{1,4}:){4}:([a-f0-9]{1,4}:){0,2}|([a-f0-9]{1,4}:){5}:([a-f0-9]{1,4}:){0,1})([a-f0-9]{1,4}|(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2})))$/,
  ipv6Cidr: /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/,
  base64: /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/,
  base64url: /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/,
  nanoid: /^[a-zA-Z0-9_-]{21}$/,
  jwt: /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/
};
function parseStringDef(def, refs) {
  const res = {
    type: "string"
  };
  if (def.checks) {
    for (const check of def.checks) {
      switch (check.kind) {
        case "min":
          setResponseValueAndErrors(res, "minLength", typeof res.minLength === "number" ? Math.max(res.minLength, check.value) : check.value, check.message, refs);
          break;
        case "max":
          setResponseValueAndErrors(res, "maxLength", typeof res.maxLength === "number" ? Math.min(res.maxLength, check.value) : check.value, check.message, refs);
          break;
        case "email":
          switch (refs.emailStrategy) {
            case "format:email":
              addFormat(res, "email", check.message, refs);
              break;
            case "format:idn-email":
              addFormat(res, "idn-email", check.message, refs);
              break;
            case "pattern:zod":
              addPattern(res, zodPatterns.email, check.message, refs);
              break;
          }
          break;
        case "url":
          addFormat(res, "uri", check.message, refs);
          break;
        case "uuid":
          addFormat(res, "uuid", check.message, refs);
          break;
        case "regex":
          addPattern(res, check.regex, check.message, refs);
          break;
        case "cuid":
          addPattern(res, zodPatterns.cuid, check.message, refs);
          break;
        case "cuid2":
          addPattern(res, zodPatterns.cuid2, check.message, refs);
          break;
        case "startsWith":
          addPattern(res, RegExp(`^${escapeLiteralCheckValue(check.value, refs)}`), check.message, refs);
          break;
        case "endsWith":
          addPattern(res, RegExp(`${escapeLiteralCheckValue(check.value, refs)}$`), check.message, refs);
          break;
        case "datetime":
          addFormat(res, "date-time", check.message, refs);
          break;
        case "date":
          addFormat(res, "date", check.message, refs);
          break;
        case "time":
          addFormat(res, "time", check.message, refs);
          break;
        case "duration":
          addFormat(res, "duration", check.message, refs);
          break;
        case "length":
          setResponseValueAndErrors(res, "minLength", typeof res.minLength === "number" ? Math.max(res.minLength, check.value) : check.value, check.message, refs);
          setResponseValueAndErrors(res, "maxLength", typeof res.maxLength === "number" ? Math.min(res.maxLength, check.value) : check.value, check.message, refs);
          break;
        case "includes": {
          addPattern(res, RegExp(escapeLiteralCheckValue(check.value, refs)), check.message, refs);
          break;
        }
        case "ip": {
          if (check.version !== "v6") {
            addFormat(res, "ipv4", check.message, refs);
          }
          if (check.version !== "v4") {
            addFormat(res, "ipv6", check.message, refs);
          }
          break;
        }
        case "base64url":
          addPattern(res, zodPatterns.base64url, check.message, refs);
          break;
        case "jwt":
          addPattern(res, zodPatterns.jwt, check.message, refs);
          break;
        case "cidr": {
          if (check.version !== "v6") {
            addPattern(res, zodPatterns.ipv4Cidr, check.message, refs);
          }
          if (check.version !== "v4") {
            addPattern(res, zodPatterns.ipv6Cidr, check.message, refs);
          }
          break;
        }
        case "emoji":
          addPattern(res, zodPatterns.emoji(), check.message, refs);
          break;
        case "ulid": {
          addPattern(res, zodPatterns.ulid, check.message, refs);
          break;
        }
        case "base64": {
          switch (refs.base64Strategy) {
            case "format:binary": {
              addFormat(res, "binary", check.message, refs);
              break;
            }
            case "contentEncoding:base64": {
              setResponseValueAndErrors(res, "contentEncoding", "base64", check.message, refs);
              break;
            }
            case "pattern:zod": {
              addPattern(res, zodPatterns.base64, check.message, refs);
              break;
            }
          }
          break;
        }
        case "nanoid": {
          addPattern(res, zodPatterns.nanoid, check.message, refs);
        }
        case "toLowerCase":
        case "toUpperCase":
        case "trim":
          break;
        default:
          /* @__PURE__ */ ((_) => {
          })(check);
      }
    }
  }
  return res;
}
function escapeLiteralCheckValue(literal, refs) {
  return refs.patternStrategy === "escape" ? escapeNonAlphaNumeric(literal) : literal;
}
var ALPHA_NUMERIC = new Set("ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvxyz0123456789");
function escapeNonAlphaNumeric(source) {
  let result = "";
  for (let i = 0; i < source.length; i++) {
    if (!ALPHA_NUMERIC.has(source[i])) {
      result += "\\";
    }
    result += source[i];
  }
  return result;
}
function addFormat(schema, value, message, refs) {
  if (schema.format || schema.anyOf?.some((x) => x.format)) {
    if (!schema.anyOf) {
      schema.anyOf = [];
    }
    if (schema.format) {
      schema.anyOf.push({
        format: schema.format,
        ...schema.errorMessage && refs.errorMessages && {
          errorMessage: { format: schema.errorMessage.format }
        }
      });
      delete schema.format;
      if (schema.errorMessage) {
        delete schema.errorMessage.format;
        if (Object.keys(schema.errorMessage).length === 0) {
          delete schema.errorMessage;
        }
      }
    }
    schema.anyOf.push({
      format: value,
      ...message && refs.errorMessages && { errorMessage: { format: message } }
    });
  } else {
    setResponseValueAndErrors(schema, "format", value, message, refs);
  }
}
function addPattern(schema, regex, message, refs) {
  if (schema.pattern || schema.allOf?.some((x) => x.pattern)) {
    if (!schema.allOf) {
      schema.allOf = [];
    }
    if (schema.pattern) {
      schema.allOf.push({
        pattern: schema.pattern,
        ...schema.errorMessage && refs.errorMessages && {
          errorMessage: { pattern: schema.errorMessage.pattern }
        }
      });
      delete schema.pattern;
      if (schema.errorMessage) {
        delete schema.errorMessage.pattern;
        if (Object.keys(schema.errorMessage).length === 0) {
          delete schema.errorMessage;
        }
      }
    }
    schema.allOf.push({
      pattern: stringifyRegExpWithFlags(regex, refs),
      ...message && refs.errorMessages && { errorMessage: { pattern: message } }
    });
  } else {
    setResponseValueAndErrors(schema, "pattern", stringifyRegExpWithFlags(regex, refs), message, refs);
  }
}
function stringifyRegExpWithFlags(regex, refs) {
  if (!refs.applyRegexFlags || !regex.flags) {
    return regex.source;
  }
  const flags = {
    i: regex.flags.includes("i"),
    m: regex.flags.includes("m"),
    s: regex.flags.includes("s")
    // `.` matches newlines
  };
  const source = flags.i ? regex.source.toLowerCase() : regex.source;
  let pattern = "";
  let isEscaped = false;
  let inCharGroup = false;
  let inCharRange = false;
  for (let i = 0; i < source.length; i++) {
    if (isEscaped) {
      pattern += source[i];
      isEscaped = false;
      continue;
    }
    if (flags.i) {
      if (inCharGroup) {
        if (source[i].match(/[a-z]/)) {
          if (inCharRange) {
            pattern += source[i];
            pattern += `${source[i - 2]}-${source[i]}`.toUpperCase();
            inCharRange = false;
          } else if (source[i + 1] === "-" && source[i + 2]?.match(/[a-z]/)) {
            pattern += source[i];
            inCharRange = true;
          } else {
            pattern += `${source[i]}${source[i].toUpperCase()}`;
          }
          continue;
        }
      } else if (source[i].match(/[a-z]/)) {
        pattern += `[${source[i]}${source[i].toUpperCase()}]`;
        continue;
      }
    }
    if (flags.m) {
      if (source[i] === "^") {
        pattern += `(^|(?<=[\r
]))`;
        continue;
      } else if (source[i] === "$") {
        pattern += `($|(?=[\r
]))`;
        continue;
      }
    }
    if (flags.s && source[i] === ".") {
      pattern += inCharGroup ? `${source[i]}\r
` : `[${source[i]}\r
]`;
      continue;
    }
    pattern += source[i];
    if (source[i] === "\\") {
      isEscaped = true;
    } else if (inCharGroup && source[i] === "]") {
      inCharGroup = false;
    } else if (!inCharGroup && source[i] === "[") {
      inCharGroup = true;
    }
  }
  try {
    new RegExp(pattern);
  } catch {
    console.warn(`Could not convert regex pattern at ${refs.currentPath.join("/")} to a flag-independent form! Falling back to the flag-ignorant source`);
    return regex.source;
  }
  return pattern;
}

// node_modules/zod-to-json-schema/dist/esm/parsers/record.js
function parseRecordDef(def, refs) {
  if (refs.target === "openAi") {
    console.warn("Warning: OpenAI may not support records in schemas! Try an array of key-value pairs instead.");
  }
  if (refs.target === "openApi3" && def.keyType?._def.typeName === ZodFirstPartyTypeKind.ZodEnum) {
    return {
      type: "object",
      required: def.keyType._def.values,
      properties: def.keyType._def.values.reduce((acc, key) => ({
        ...acc,
        [key]: parseDef(def.valueType._def, {
          ...refs,
          currentPath: [...refs.currentPath, "properties", key]
        }) ?? parseAnyDef(refs)
      }), {}),
      additionalProperties: refs.rejectedAdditionalProperties
    };
  }
  const schema = {
    type: "object",
    additionalProperties: parseDef(def.valueType._def, {
      ...refs,
      currentPath: [...refs.currentPath, "additionalProperties"]
    }) ?? refs.allowedAdditionalProperties
  };
  if (refs.target === "openApi3") {
    return schema;
  }
  if (def.keyType?._def.typeName === ZodFirstPartyTypeKind.ZodString && def.keyType._def.checks?.length) {
    const { type, ...keyType } = parseStringDef(def.keyType._def, refs);
    return {
      ...schema,
      propertyNames: keyType
    };
  } else if (def.keyType?._def.typeName === ZodFirstPartyTypeKind.ZodEnum) {
    return {
      ...schema,
      propertyNames: {
        enum: def.keyType._def.values
      }
    };
  } else if (def.keyType?._def.typeName === ZodFirstPartyTypeKind.ZodBranded && def.keyType._def.type._def.typeName === ZodFirstPartyTypeKind.ZodString && def.keyType._def.type._def.checks?.length) {
    const { type, ...keyType } = parseBrandedDef(def.keyType._def, refs);
    return {
      ...schema,
      propertyNames: keyType
    };
  }
  return schema;
}

// node_modules/zod-to-json-schema/dist/esm/parsers/map.js
function parseMapDef(def, refs) {
  if (refs.mapStrategy === "record") {
    return parseRecordDef(def, refs);
  }
  const keys = parseDef(def.keyType._def, {
    ...refs,
    currentPath: [...refs.currentPath, "items", "items", "0"]
  }) || parseAnyDef(refs);
  const values = parseDef(def.valueType._def, {
    ...refs,
    currentPath: [...refs.currentPath, "items", "items", "1"]
  }) || parseAnyDef(refs);
  return {
    type: "array",
    maxItems: 125,
    items: {
      type: "array",
      items: [keys, values],
      minItems: 2,
      maxItems: 2
    }
  };
}

// node_modules/zod-to-json-schema/dist/esm/parsers/nativeEnum.js
function parseNativeEnumDef(def) {
  const object = def.values;
  const actualKeys = Object.keys(def.values).filter((key) => {
    return typeof object[object[key]] !== "number";
  });
  const actualValues = actualKeys.map((key) => object[key]);
  const parsedTypes = Array.from(new Set(actualValues.map((values) => typeof values)));
  return {
    type: parsedTypes.length === 1 ? parsedTypes[0] === "string" ? "string" : "number" : ["string", "number"],
    enum: actualValues
  };
}

// node_modules/zod-to-json-schema/dist/esm/parsers/never.js
function parseNeverDef(refs) {
  return refs.target === "openAi" ? void 0 : {
    not: parseAnyDef({
      ...refs,
      currentPath: [...refs.currentPath, "not"]
    })
  };
}

// node_modules/zod-to-json-schema/dist/esm/parsers/null.js
function parseNullDef(refs) {
  return refs.target === "openApi3" ? {
    enum: ["null"],
    nullable: true
  } : {
    type: "null"
  };
}

// node_modules/zod-to-json-schema/dist/esm/parsers/union.js
var primitiveMappings = {
  ZodString: "string",
  ZodNumber: "number",
  ZodBigInt: "integer",
  ZodBoolean: "boolean",
  ZodNull: "null"
};
function parseUnionDef(def, refs) {
  if (refs.target === "openApi3")
    return asAnyOf(def, refs);
  const options = def.options instanceof Map ? Array.from(def.options.values()) : def.options;
  if (options.every((x) => x._def.typeName in primitiveMappings && (!x._def.checks || !x._def.checks.length))) {
    const types = options.reduce((types2, x) => {
      const type = primitiveMappings[x._def.typeName];
      return type && !types2.includes(type) ? [...types2, type] : types2;
    }, []);
    return {
      type: types.length > 1 ? types : types[0]
    };
  } else if (options.every((x) => x._def.typeName === "ZodLiteral" && !x.description)) {
    const types = options.reduce((acc, x) => {
      const type = typeof x._def.value;
      switch (type) {
        case "string":
        case "number":
        case "boolean":
          return [...acc, type];
        case "bigint":
          return [...acc, "integer"];
        case "object":
          if (x._def.value === null)
            return [...acc, "null"];
        case "symbol":
        case "undefined":
        case "function":
        default:
          return acc;
      }
    }, []);
    if (types.length === options.length) {
      const uniqueTypes = types.filter((x, i, a) => a.indexOf(x) === i);
      return {
        type: uniqueTypes.length > 1 ? uniqueTypes : uniqueTypes[0],
        enum: options.reduce((acc, x) => {
          return acc.includes(x._def.value) ? acc : [...acc, x._def.value];
        }, [])
      };
    }
  } else if (options.every((x) => x._def.typeName === "ZodEnum")) {
    return {
      type: "string",
      enum: options.reduce((acc, x) => [
        ...acc,
        ...x._def.values.filter((x2) => !acc.includes(x2))
      ], [])
    };
  }
  return asAnyOf(def, refs);
}
var asAnyOf = (def, refs) => {
  const anyOf = (def.options instanceof Map ? Array.from(def.options.values()) : def.options).map((x, i) => parseDef(x._def, {
    ...refs,
    currentPath: [...refs.currentPath, "anyOf", `${i}`]
  })).filter((x) => !!x && (!refs.strictUnions || typeof x === "object" && Object.keys(x).length > 0));
  return anyOf.length ? { anyOf } : void 0;
};

// node_modules/zod-to-json-schema/dist/esm/parsers/nullable.js
function parseNullableDef(def, refs) {
  if (["ZodString", "ZodNumber", "ZodBigInt", "ZodBoolean", "ZodNull"].includes(def.innerType._def.typeName) && (!def.innerType._def.checks || !def.innerType._def.checks.length)) {
    if (refs.target === "openApi3") {
      return {
        type: primitiveMappings[def.innerType._def.typeName],
        nullable: true
      };
    }
    return {
      type: [
        primitiveMappings[def.innerType._def.typeName],
        "null"
      ]
    };
  }
  if (refs.target === "openApi3") {
    const base2 = parseDef(def.innerType._def, {
      ...refs,
      currentPath: [...refs.currentPath]
    });
    if (base2 && "$ref" in base2)
      return { allOf: [base2], nullable: true };
    return base2 && { ...base2, nullable: true };
  }
  const base = parseDef(def.innerType._def, {
    ...refs,
    currentPath: [...refs.currentPath, "anyOf", "0"]
  });
  return base && { anyOf: [base, { type: "null" }] };
}

// node_modules/zod-to-json-schema/dist/esm/parsers/number.js
function parseNumberDef(def, refs) {
  const res = {
    type: "number"
  };
  if (!def.checks)
    return res;
  for (const check of def.checks) {
    switch (check.kind) {
      case "int":
        res.type = "integer";
        addErrorMessage(res, "type", check.message, refs);
        break;
      case "min":
        if (refs.target === "jsonSchema7") {
          if (check.inclusive) {
            setResponseValueAndErrors(res, "minimum", check.value, check.message, refs);
          } else {
            setResponseValueAndErrors(res, "exclusiveMinimum", check.value, check.message, refs);
          }
        } else {
          if (!check.inclusive) {
            res.exclusiveMinimum = true;
          }
          setResponseValueAndErrors(res, "minimum", check.value, check.message, refs);
        }
        break;
      case "max":
        if (refs.target === "jsonSchema7") {
          if (check.inclusive) {
            setResponseValueAndErrors(res, "maximum", check.value, check.message, refs);
          } else {
            setResponseValueAndErrors(res, "exclusiveMaximum", check.value, check.message, refs);
          }
        } else {
          if (!check.inclusive) {
            res.exclusiveMaximum = true;
          }
          setResponseValueAndErrors(res, "maximum", check.value, check.message, refs);
        }
        break;
      case "multipleOf":
        setResponseValueAndErrors(res, "multipleOf", check.value, check.message, refs);
        break;
    }
  }
  return res;
}

// node_modules/zod-to-json-schema/dist/esm/parsers/object.js
function parseObjectDef(def, refs) {
  const forceOptionalIntoNullable = refs.target === "openAi";
  const result = {
    type: "object",
    properties: {}
  };
  const required = [];
  const shape = def.shape();
  for (const propName in shape) {
    let propDef = shape[propName];
    if (propDef === void 0 || propDef._def === void 0) {
      continue;
    }
    let propOptional = safeIsOptional(propDef);
    if (propOptional && forceOptionalIntoNullable) {
      if (propDef._def.typeName === "ZodOptional") {
        propDef = propDef._def.innerType;
      }
      if (!propDef.isNullable()) {
        propDef = propDef.nullable();
      }
      propOptional = false;
    }
    const parsedDef = parseDef(propDef._def, {
      ...refs,
      currentPath: [...refs.currentPath, "properties", propName],
      propertyPath: [...refs.currentPath, "properties", propName]
    });
    if (parsedDef === void 0) {
      continue;
    }
    result.properties[propName] = parsedDef;
    if (!propOptional) {
      required.push(propName);
    }
  }
  if (required.length) {
    result.required = required;
  }
  const additionalProperties = decideAdditionalProperties(def, refs);
  if (additionalProperties !== void 0) {
    result.additionalProperties = additionalProperties;
  }
  return result;
}
function decideAdditionalProperties(def, refs) {
  if (def.catchall._def.typeName !== "ZodNever") {
    return parseDef(def.catchall._def, {
      ...refs,
      currentPath: [...refs.currentPath, "additionalProperties"]
    });
  }
  switch (def.unknownKeys) {
    case "passthrough":
      return refs.allowedAdditionalProperties;
    case "strict":
      return refs.rejectedAdditionalProperties;
    case "strip":
      return refs.removeAdditionalStrategy === "strict" ? refs.allowedAdditionalProperties : refs.rejectedAdditionalProperties;
  }
}
function safeIsOptional(schema) {
  try {
    return schema.isOptional();
  } catch {
    return true;
  }
}

// node_modules/zod-to-json-schema/dist/esm/parsers/optional.js
var parseOptionalDef = (def, refs) => {
  if (refs.currentPath.toString() === refs.propertyPath?.toString()) {
    return parseDef(def.innerType._def, refs);
  }
  const innerSchema = parseDef(def.innerType._def, {
    ...refs,
    currentPath: [...refs.currentPath, "anyOf", "1"]
  });
  return innerSchema ? {
    anyOf: [
      {
        not: parseAnyDef(refs)
      },
      innerSchema
    ]
  } : parseAnyDef(refs);
};

// node_modules/zod-to-json-schema/dist/esm/parsers/pipeline.js
var parsePipelineDef = (def, refs) => {
  if (refs.pipeStrategy === "input") {
    return parseDef(def.in._def, refs);
  } else if (refs.pipeStrategy === "output") {
    return parseDef(def.out._def, refs);
  }
  const a = parseDef(def.in._def, {
    ...refs,
    currentPath: [...refs.currentPath, "allOf", "0"]
  });
  const b = parseDef(def.out._def, {
    ...refs,
    currentPath: [...refs.currentPath, "allOf", a ? "1" : "0"]
  });
  return {
    allOf: [a, b].filter((x) => x !== void 0)
  };
};

// node_modules/zod-to-json-schema/dist/esm/parsers/promise.js
function parsePromiseDef(def, refs) {
  return parseDef(def.type._def, refs);
}

// node_modules/zod-to-json-schema/dist/esm/parsers/set.js
function parseSetDef(def, refs) {
  const items = parseDef(def.valueType._def, {
    ...refs,
    currentPath: [...refs.currentPath, "items"]
  });
  const schema = {
    type: "array",
    uniqueItems: true,
    items
  };
  if (def.minSize) {
    setResponseValueAndErrors(schema, "minItems", def.minSize.value, def.minSize.message, refs);
  }
  if (def.maxSize) {
    setResponseValueAndErrors(schema, "maxItems", def.maxSize.value, def.maxSize.message, refs);
  }
  return schema;
}

// node_modules/zod-to-json-schema/dist/esm/parsers/tuple.js
function parseTupleDef(def, refs) {
  if (def.rest) {
    return {
      type: "array",
      minItems: def.items.length,
      items: def.items.map((x, i) => parseDef(x._def, {
        ...refs,
        currentPath: [...refs.currentPath, "items", `${i}`]
      })).reduce((acc, x) => x === void 0 ? acc : [...acc, x], []),
      additionalItems: parseDef(def.rest._def, {
        ...refs,
        currentPath: [...refs.currentPath, "additionalItems"]
      })
    };
  } else {
    return {
      type: "array",
      minItems: def.items.length,
      maxItems: def.items.length,
      items: def.items.map((x, i) => parseDef(x._def, {
        ...refs,
        currentPath: [...refs.currentPath, "items", `${i}`]
      })).reduce((acc, x) => x === void 0 ? acc : [...acc, x], [])
    };
  }
}

// node_modules/zod-to-json-schema/dist/esm/parsers/undefined.js
function parseUndefinedDef(refs) {
  return {
    not: parseAnyDef(refs)
  };
}

// node_modules/zod-to-json-schema/dist/esm/parsers/unknown.js
function parseUnknownDef(refs) {
  return parseAnyDef(refs);
}

// node_modules/zod-to-json-schema/dist/esm/parsers/readonly.js
var parseReadonlyDef = (def, refs) => {
  return parseDef(def.innerType._def, refs);
};

// node_modules/zod-to-json-schema/dist/esm/selectParser.js
var selectParser = (def, typeName, refs) => {
  switch (typeName) {
    case ZodFirstPartyTypeKind.ZodString:
      return parseStringDef(def, refs);
    case ZodFirstPartyTypeKind.ZodNumber:
      return parseNumberDef(def, refs);
    case ZodFirstPartyTypeKind.ZodObject:
      return parseObjectDef(def, refs);
    case ZodFirstPartyTypeKind.ZodBigInt:
      return parseBigintDef(def, refs);
    case ZodFirstPartyTypeKind.ZodBoolean:
      return parseBooleanDef();
    case ZodFirstPartyTypeKind.ZodDate:
      return parseDateDef(def, refs);
    case ZodFirstPartyTypeKind.ZodUndefined:
      return parseUndefinedDef(refs);
    case ZodFirstPartyTypeKind.ZodNull:
      return parseNullDef(refs);
    case ZodFirstPartyTypeKind.ZodArray:
      return parseArrayDef(def, refs);
    case ZodFirstPartyTypeKind.ZodUnion:
    case ZodFirstPartyTypeKind.ZodDiscriminatedUnion:
      return parseUnionDef(def, refs);
    case ZodFirstPartyTypeKind.ZodIntersection:
      return parseIntersectionDef(def, refs);
    case ZodFirstPartyTypeKind.ZodTuple:
      return parseTupleDef(def, refs);
    case ZodFirstPartyTypeKind.ZodRecord:
      return parseRecordDef(def, refs);
    case ZodFirstPartyTypeKind.ZodLiteral:
      return parseLiteralDef(def, refs);
    case ZodFirstPartyTypeKind.ZodEnum:
      return parseEnumDef(def);
    case ZodFirstPartyTypeKind.ZodNativeEnum:
      return parseNativeEnumDef(def);
    case ZodFirstPartyTypeKind.ZodNullable:
      return parseNullableDef(def, refs);
    case ZodFirstPartyTypeKind.ZodOptional:
      return parseOptionalDef(def, refs);
    case ZodFirstPartyTypeKind.ZodMap:
      return parseMapDef(def, refs);
    case ZodFirstPartyTypeKind.ZodSet:
      return parseSetDef(def, refs);
    case ZodFirstPartyTypeKind.ZodLazy:
      return () => def.getter()._def;
    case ZodFirstPartyTypeKind.ZodPromise:
      return parsePromiseDef(def, refs);
    case ZodFirstPartyTypeKind.ZodNaN:
    case ZodFirstPartyTypeKind.ZodNever:
      return parseNeverDef(refs);
    case ZodFirstPartyTypeKind.ZodEffects:
      return parseEffectsDef(def, refs);
    case ZodFirstPartyTypeKind.ZodAny:
      return parseAnyDef(refs);
    case ZodFirstPartyTypeKind.ZodUnknown:
      return parseUnknownDef(refs);
    case ZodFirstPartyTypeKind.ZodDefault:
      return parseDefaultDef(def, refs);
    case ZodFirstPartyTypeKind.ZodBranded:
      return parseBrandedDef(def, refs);
    case ZodFirstPartyTypeKind.ZodReadonly:
      return parseReadonlyDef(def, refs);
    case ZodFirstPartyTypeKind.ZodCatch:
      return parseCatchDef(def, refs);
    case ZodFirstPartyTypeKind.ZodPipeline:
      return parsePipelineDef(def, refs);
    case ZodFirstPartyTypeKind.ZodFunction:
    case ZodFirstPartyTypeKind.ZodVoid:
    case ZodFirstPartyTypeKind.ZodSymbol:
      return void 0;
    default:
      return /* @__PURE__ */ ((_) => void 0)(typeName);
  }
};

// node_modules/zod-to-json-schema/dist/esm/parseDef.js
function parseDef(def, refs, forceResolution = false) {
  const seenItem = refs.seen.get(def);
  if (refs.override) {
    const overrideResult = refs.override?.(def, refs, seenItem, forceResolution);
    if (overrideResult !== ignoreOverride) {
      return overrideResult;
    }
  }
  if (seenItem && !forceResolution) {
    const seenSchema = get$ref(seenItem, refs);
    if (seenSchema !== void 0) {
      return seenSchema;
    }
  }
  const newItem = { def, path: refs.currentPath, jsonSchema: void 0 };
  refs.seen.set(def, newItem);
  const jsonSchemaOrGetter = selectParser(def, def.typeName, refs);
  const jsonSchema = typeof jsonSchemaOrGetter === "function" ? parseDef(jsonSchemaOrGetter(), refs) : jsonSchemaOrGetter;
  if (jsonSchema) {
    addMeta(def, refs, jsonSchema);
  }
  if (refs.postProcess) {
    const postProcessResult = refs.postProcess(jsonSchema, def, refs);
    newItem.jsonSchema = jsonSchema;
    return postProcessResult;
  }
  newItem.jsonSchema = jsonSchema;
  return jsonSchema;
}
var get$ref = (item, refs) => {
  switch (refs.$refStrategy) {
    case "root":
      return { $ref: item.path.join("/") };
    case "relative":
      return { $ref: getRelativePath(refs.currentPath, item.path) };
    case "none":
    case "seen": {
      if (item.path.length < refs.currentPath.length && item.path.every((value, index) => refs.currentPath[index] === value)) {
        console.warn(`Recursive reference detected at ${refs.currentPath.join("/")}! Defaulting to any`);
        return parseAnyDef(refs);
      }
      return refs.$refStrategy === "seen" ? parseAnyDef(refs) : void 0;
    }
  }
};
var addMeta = (def, refs, jsonSchema) => {
  if (def.description) {
    jsonSchema.description = def.description;
    if (refs.markdownDescription) {
      jsonSchema.markdownDescription = def.description;
    }
  }
  return jsonSchema;
};

// node_modules/zod-to-json-schema/dist/esm/zodToJsonSchema.js
var zodToJsonSchema = (schema, options) => {
  const refs = getRefs(options);
  let definitions = typeof options === "object" && options.definitions ? Object.entries(options.definitions).reduce((acc, [name2, schema2]) => ({
    ...acc,
    [name2]: parseDef(schema2._def, {
      ...refs,
      currentPath: [...refs.basePath, refs.definitionPath, name2]
    }, true) ?? parseAnyDef(refs)
  }), {}) : void 0;
  const name = typeof options === "string" ? options : options?.nameStrategy === "title" ? void 0 : options?.name;
  const main3 = parseDef(schema._def, name === void 0 ? refs : {
    ...refs,
    currentPath: [...refs.basePath, refs.definitionPath, name]
  }, false) ?? parseAnyDef(refs);
  const title = typeof options === "object" && options.name !== void 0 && options.nameStrategy === "title" ? options.name : void 0;
  if (title !== void 0) {
    main3.title = title;
  }
  if (refs.flags.hasReferencedOpenAiAnyType) {
    if (!definitions) {
      definitions = {};
    }
    if (!definitions[refs.openAiAnyTypeName]) {
      definitions[refs.openAiAnyTypeName] = {
        // Skipping "object" as no properties can be defined and additionalProperties must be "false"
        type: ["string", "number", "integer", "boolean", "array", "null"],
        items: {
          $ref: refs.$refStrategy === "relative" ? "1" : [
            ...refs.basePath,
            refs.definitionPath,
            refs.openAiAnyTypeName
          ].join("/")
        }
      };
    }
  }
  const combined = name === void 0 ? definitions ? {
    ...main3,
    [refs.definitionPath]: definitions
  } : main3 : {
    $ref: [
      ...refs.$refStrategy === "relative" ? [] : refs.basePath,
      refs.definitionPath,
      name
    ].join("/"),
    [refs.definitionPath]: {
      ...definitions,
      [name]: main3
    }
  };
  if (refs.target === "jsonSchema7") {
    combined.$schema = "http://json-schema.org/draft-07/schema#";
  } else if (refs.target === "jsonSchema2019-09" || refs.target === "openAi") {
    combined.$schema = "https://json-schema.org/draft/2019-09/schema#";
  }
  if (refs.target === "openAi" && ("anyOf" in combined || "oneOf" in combined || "allOf" in combined || "type" in combined && Array.isArray(combined.type))) {
    console.warn("Warning: OpenAI may not support schemas with unions as roots! Try wrapping it in an object property.");
  }
  return combined;
};

// src/scripts/_lib/module_detection.ts
import * as fs17 from "node:fs";
import * as path15 from "node:path";
var _SKIP_DIRS = /* @__PURE__ */ new Set([".module-template", ".example"]);
var _RULES = [
  ["app/Modules", "laravel-hmvc", "App\\Modules\\{ModuleName}"],
  ["src/Module", "symfony-ddd", "App\\Module\\{ModuleName}"],
  ["packages", "node-monorepo", ""],
  ["apps", "node-monorepo", ""],
  ["modules", "node-monorepo", ""],
  ["src", "python-src", ""],
  ["internal", "go-internal", ""],
  ["cmd", "go-internal", ""]
];
function _isDir(p) {
  try {
    return fs17.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
function _isFile(p) {
  try {
    return fs17.statSync(p).isFile();
  } catch {
    return false;
  }
}
function _isUpperChar(ch) {
  if (!ch) {
    return false;
  }
  return ch === ch.toUpperCase() && ch !== ch.toLowerCase();
}
function _list_module_subdirs(root) {
  let entries;
  try {
    entries = fs17.readdirSync(root).sort();
  } catch {
    return [];
  }
  const out = [];
  for (const name of entries) {
    if (!_isDir(path15.join(root, name))) {
      continue;
    }
    if (name.startsWith(".")) {
      continue;
    }
    if (_SKIP_DIRS.has(name)) {
      continue;
    }
    out.push(name);
  }
  return out;
}
function _score_confidence(stack, root, subdirs) {
  if (subdirs.length === 0) {
    return "medium";
  }
  if (stack === "laravel-hmvc" || stack === "symfony-ddd") {
    const capitalized = subdirs.filter((name) => _isUpperChar(name.slice(0, 1)));
    return capitalized.length > 0 ? "high" : "medium";
  }
  if (stack === "node-monorepo") {
    const withPkgJson = subdirs.filter((name) => _isFile(path15.join(root, name, "package.json")));
    return withPkgJson.length > 0 ? "high" : "medium";
  }
  if (stack === "python-src") {
    const withInit = subdirs.filter((name) => _isFile(path15.join(root, name, "__init__.py")));
    return withInit.length > 0 ? "high" : "medium";
  }
  if (stack === "go-internal") {
    return subdirs.length > 0 ? "high" : "medium";
  }
  return "medium";
}
function detect_module_roots(project_root) {
  const high = [];
  const medium = [];
  for (const [rel_path, stack, namespace_template] of _RULES) {
    const abs_path = path15.join(project_root, rel_path);
    if (!_isDir(abs_path)) {
      continue;
    }
    const subdirs = _list_module_subdirs(abs_path);
    const confidence = _score_confidence(stack, abs_path, subdirs);
    const candidate = {
      path: rel_path,
      stack,
      namespace_template_guess: namespace_template,
      confidence
    };
    if (confidence === "high") {
      high.push(candidate);
    } else {
      medium.push(candidate);
    }
  }
  return [...high, ...medium];
}

// src/scripts/_lib/model_tier.ts
import fs18 from "node:fs";
var TIER_TO_CLAUDE_MODEL = {
  frontier: "fable",
  high: "opus",
  medium: "sonnet",
  lite: "haiku"
};
var MODEL_TIER_RE = /^model_tier:\s*"?([a-z]+)"?\s*$/m;
function read_model_tier(skill_md) {
  if (!fs18.existsSync(skill_md)) return null;
  const text = fs18.readFileSync(skill_md).toString("utf-8");
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---\n", 4);
  if (end === -1) return null;
  const m = MODEL_TIER_RE.exec(text.slice(4, end));
  return m ? m[1] : null;
}
function render_native_model_md(text, tier) {
  const model = TIER_TO_CLAUDE_MODEL[tier];
  if (model === void 0) {
    throw new Error(`'${tier}'`);
  }
  return text.replace(MODEL_TIER_RE, `model: ${model}`);
}

// src/scripts/_cli/cmd_migrate.ts
import { spawnSync } from "node:child_process";
import * as fs20 from "node:fs";
import * as path17 from "node:path";
import process2 from "node:process";
import { fileURLToPath as fileURLToPath4, pathToFileURL } from "node:url";

// src/scripts/_lib/package_root.ts
import * as fs19 from "node:fs";
import * as path16 from "node:path";
import { fileURLToPath as fileURLToPath3 } from "node:url";
var PACKAGE_NAME = "@event4u/agent-config";
var MAX_ASCENT = 16;
function resolvePackageRoot(fromUrlOrPath, legacyHops = 3) {
  const start = fromUrlOrPath.startsWith("file:") ? fileURLToPath3(fromUrlOrPath) : fromUrlOrPath;
  const startDir = path16.dirname(start);
  let dir = startDir;
  for (let i = 0; i < MAX_ASCENT; i++) {
    const manifest = path16.join(dir, "package.json");
    if (fs19.existsSync(manifest)) {
      try {
        const parsed = JSON.parse(fs19.readFileSync(manifest, "utf8"));
        if (parsed.name === PACKAGE_NAME) {
          return dir;
        }
      } catch {
      }
    }
    const parent = path16.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return path16.resolve(startDir, ...Array.from({ length: legacyHops }, () => ".."));
}

// src/scripts/_cli/cmd_migrate.ts
var PACKAGE_NAME_NPM = "@event4u/agent-config";
var PACKAGE_NAME_COMPOSER = "event4u/agent-config";
var LEGACY_DIRS = ["vendor", "node_modules"];
var MANAGED_SYMLINKS = [
  ".augment",
  ".claude",
  ".cursor",
  ".clinerules",
  ".windsurfrules"
];
var GITIGNORE_BLOCK_START = "# >>> event4u/agent-config (managed) >>>";
var GITIGNORE_BLOCK_END = "# <<< event4u/agent-config (managed) <<<";
var GITIGNORE_NEW_BODY = ".agent-settings.yml\nagents/sessions/\nagents/runtime/council/responses/\nagents/runtime/council/sessions/\n";
var LEGACY_SETTINGS_FILES = [".agent-settings.yml", ".agent-user.yml"];
var LEGACY_STATE_FILENAME = ".implement-ticket-state.json";
var LEGACY_STATE_V1_FILENAME = ".work-state.json";
var LEGACY_AGENT_CONFIG_SHELL = "agent-config";
var _HERE_DIR = path17.dirname(fileURLToPath4(import.meta.url));
var ArgparseExit = class extends Error {
  code;
  constructor(code) {
    super(`ArgparseExit(${code})`);
    this.name = "ArgparseExit";
    this.code = code;
  }
};
function _stdoutSink() {
  return { write: (t) => process2.stdout.write(t) };
}
function _stderrSink() {
  return { write: (t) => process2.stderr.write(t) };
}
function _print(out, line = "") {
  out.write(line + "\n");
}
function _jsonStrAscii(s) {
  let out = '"';
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    const ch = s[i];
    switch (ch) {
      case '"':
        out += '\\"';
        break;
      case "\\":
        out += "\\\\";
        break;
      case "\n":
        out += "\\n";
        break;
      case "\r":
        out += "\\r";
        break;
      case "	":
        out += "\\t";
        break;
      case "\b":
        out += "\\b";
        break;
      case "\f":
        out += "\\f";
        break;
      default:
        if (code < 32 || code > 126) {
          out += "\\u" + code.toString(16).padStart(4, "0");
        } else {
          out += ch;
        }
    }
  }
  return out + '"';
}
function _jsonScalarAscii(value) {
  if (value === null || value === void 0) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      if (Number.isNaN(value)) return "NaN";
      return value > 0 ? "Infinity" : "-Infinity";
    }
    if (Number.isInteger(value)) return String(value);
    return String(value);
  }
  if (typeof value === "string") return _jsonStrAscii(value);
  return null;
}
function _dumpIndentAscii(value, indent, depth) {
  const scalar = _jsonScalarAscii(value);
  if (scalar !== null) return scalar;
  const pad = " ".repeat(indent * (depth + 1));
  const closePad = " ".repeat(indent * depth);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((v) => pad + _dumpIndentAscii(v, indent, depth + 1));
    return `[
${items.join(",\n")}
${closePad}]`;
  }
  if (typeof value === "object" && value !== null) {
    const obj = value;
    const keys = Object.keys(obj);
    if (keys.length === 0) return "{}";
    const items = keys.map(
      (k) => `${pad}${_jsonStrAscii(k)}: ${_dumpIndentAscii(obj[k], indent, depth + 1)}`
    );
    return `{
${items.join(",\n")}
${closePad}}`;
  }
  return _jsonStrAscii(String(value));
}
function _jsonDumpsIndentAscii(value, indent) {
  return _dumpIndentAscii(value, indent, 0);
}
function _isFile2(p) {
  try {
    return fs20.statSync(p).isFile();
  } catch {
    return false;
  }
}
function _isDir2(p) {
  try {
    return fs20.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
function _isSymlink(p) {
  try {
    return fs20.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}
function _exists2(p) {
  try {
    fs20.lstatSync(p);
    return true;
  } catch {
    return false;
  }
}
function _readText(p) {
  return fs20.readFileSync(p, { encoding: "utf-8" });
}
function _writeText(p, text) {
  fs20.writeFileSync(p, text, { encoding: "utf-8" });
}
function _jsonLoadFile(p) {
  return JSON.parse(_readText(p));
}
function _isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function _detect_npm(pkg_json) {
  if (!_isFile2(pkg_json)) {
    return false;
  }
  let data;
  try {
    data = _jsonLoadFile(pkg_json);
  } catch {
    return false;
  }
  if (!_isPlainObject(data)) {
    return false;
  }
  for (const key of ["dependencies", "devDependencies"]) {
    const section = data[key] ?? {};
    if (_isPlainObject(section) && PACKAGE_NAME_NPM in section) {
      return true;
    }
  }
  return false;
}
function _detect_composer(composer_json) {
  if (!_isFile2(composer_json)) {
    return false;
  }
  let data;
  try {
    data = _jsonLoadFile(composer_json);
  } catch {
    return false;
  }
  if (!_isPlainObject(data)) {
    return false;
  }
  for (const key of ["require", "require-dev"]) {
    const section = data[key] ?? {};
    if (_isPlainObject(section) && PACKAGE_NAME_COMPOSER in section) {
      return true;
    }
  }
  return false;
}
function _classify_symlink(link) {
  if (!_isSymlink(link)) {
    return null;
  }
  let target;
  try {
    target = fs20.readlinkSync(link);
  } catch {
    return null;
  }
  const target_str = target;
  if (LEGACY_DIRS.some((seg) => target_str.split("/").includes(seg))) {
    return "legacy";
  }
  return "user";
}
function _detect_legacy_state(project) {
  return _isFile2(path17.join(project, LEGACY_STATE_FILENAME));
}
function _detect_legacy_settings(project) {
  const found = [];
  for (const name of LEGACY_SETTINGS_FILES) {
    const flat = path17.join(project, name);
    if (_isFile2(flat)) {
      found.push(flat);
    }
    const typed = path17.join(project, "settings", name);
    if (_isFile2(typed)) {
      found.push(typed);
    }
  }
  return found;
}
function _detect_empty_shell(project) {
  const shell = path17.join(project, LEGACY_AGENT_CONFIG_SHELL);
  if (!_isDir2(shell) || _isSymlink(shell)) {
    return false;
  }
  try {
    return fs20.readdirSync(shell).length === 0;
  } catch {
    return false;
  }
}
function _detect_already_migrated(project) {
  if (_detect_npm(path17.join(project, "package.json"))) {
    return false;
  }
  if (_detect_composer(path17.join(project, "composer.json"))) {
    return false;
  }
  for (const name of MANAGED_SYMLINKS) {
    if (_classify_symlink(path17.join(project, name)) === "legacy") {
      return false;
    }
  }
  if (_detect_legacy_state(project)) {
    return false;
  }
  if (_detect_legacy_settings(project).length) {
    return false;
  }
  if (_detect_empty_shell(project)) {
    return false;
  }
  return true;
}
function _strip_npm_entry(pkg_json) {
  let data;
  try {
    data = _jsonLoadFile(pkg_json);
  } catch {
    return false;
  }
  if (!_isPlainObject(data)) {
    return false;
  }
  let changed = false;
  for (const key of ["dependencies", "devDependencies"]) {
    const section = data[key];
    if (_isPlainObject(section) && PACKAGE_NAME_NPM in section) {
      delete section[PACKAGE_NAME_NPM];
      changed = true;
      if (Object.keys(section).length === 0) {
        delete data[key];
      }
    }
  }
  if (changed) {
    _writeText(pkg_json, _jsonDumpsIndentAscii(data, 2) + "\n");
  }
  return changed;
}
function _strip_composer_entry(composer_json) {
  let data;
  try {
    data = _jsonLoadFile(composer_json);
  } catch {
    return false;
  }
  if (!_isPlainObject(data)) {
    return false;
  }
  let changed = false;
  for (const key of ["require", "require-dev"]) {
    const section = data[key];
    if (_isPlainObject(section) && PACKAGE_NAME_COMPOSER in section) {
      delete section[PACKAGE_NAME_COMPOSER];
      changed = true;
      if (Object.keys(section).length === 0) {
        delete data[key];
      }
    }
  }
  if (changed) {
    _writeText(composer_json, _jsonDumpsIndentAscii(data, 2) + "\n");
  }
  return changed;
}
function _purge_legacy_symlinks(project) {
  const removed = [];
  const preserved = [];
  for (const name of MANAGED_SYMLINKS) {
    const link = path17.join(project, name);
    const kind = _classify_symlink(link);
    if (kind === "legacy") {
      try {
        fs20.unlinkSync(link);
        removed.push(name);
      } catch {
        preserved.push(name);
      }
    } else if (kind === "user") {
      preserved.push(name);
    }
  }
  return [removed, preserved];
}
function _migrate_state_file(project) {
  const source = path17.join(project, LEGACY_STATE_FILENAME);
  if (!_isFile2(source)) {
    return null;
  }
  const target = path17.join(project, LEGACY_STATE_V1_FILENAME);
  if (_exists2(target)) {
    try {
      fs20.unlinkSync(source);
      return `removed stale ${LEGACY_STATE_FILENAME} (v1 already present)`;
    } catch {
      return null;
    }
  }
  const migrator = _load_state_migrator();
  if (migrator === null) {
    return null;
  }
  migrator(source, { destination: target, backup: true });
  return `migrated ${LEGACY_STATE_FILENAME} \u2192 ${LEGACY_STATE_V1_FILENAME}`;
}
function _load_state_migrator() {
  const pkg_root = resolvePackageRoot(import.meta.url);
  const rel = path17.join(
    "agent-src",
    "templates",
    "scripts",
    "work_engine",
    "migration",
    "v0_to_v1.ts"
  );
  const driver = [path17.join(pkg_root, "dist", rel), path17.join(pkg_root, "src", rel)].find(
    (p) => fs20.existsSync(p)
  ) ?? null;
  if (driver === null) {
    return null;
  }
  const binName = process2.platform === "win32" ? "tsx.cmd" : "tsx";
  let tsxBin = null;
  for (let dir = pkg_root; ; ) {
    const cand = path17.join(dir, "node_modules", ".bin", binName);
    if (fs20.existsSync(cand)) {
      tsxBin = cand;
      break;
    }
    const parent = path17.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const command = tsxBin ?? "npx";
  const prefix = tsxBin !== null ? [] : ["tsx"];
  return (source, opts = {}) => {
    const args = [...prefix, driver, source];
    if (opts.destination !== void 0 && opts.destination !== null) {
      args.push("--destination", opts.destination);
    }
    if (opts.backup === false) {
      args.push("--no-backup");
    }
    const r = spawnSync(command, args, { encoding: "utf8" });
    if (r.status !== 0) {
      throw new Error(
        `v0\u2192v1 state migration failed (exit ${r.status ?? "null"}): ${(r.stderr ?? "").trim()}`
      );
    }
    return (r.stdout ?? "").trim();
  };
}
function _delete_legacy_settings(project) {
  const removed = [];
  for (const p of _detect_legacy_settings(project)) {
    try {
      fs20.unlinkSync(p);
      removed.push(path17.relative(project, p));
    } catch {
      continue;
    }
  }
  const settings_dir = path17.join(project, "settings");
  if (_isDir2(settings_dir) && !_isSymlink(settings_dir)) {
    try {
      if (fs20.readdirSync(settings_dir).length === 0) {
        fs20.rmdirSync(settings_dir);
        removed.push("settings/");
      }
    } catch {
    }
  }
  return removed;
}
function _remove_empty_shell(project) {
  const shell = path17.join(project, LEGACY_AGENT_CONFIG_SHELL);
  if (!_detect_empty_shell(project)) {
    return false;
  }
  try {
    fs20.rmdirSync(shell);
  } catch {
    return false;
  }
  return true;
}
function _reEscape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function _update_gitignore(project) {
  const gitignore = path17.join(project, ".gitignore");
  const block = `${GITIGNORE_BLOCK_START}
${GITIGNORE_NEW_BODY}${GITIGNORE_BLOCK_END}
`;
  if (!_exists2(gitignore)) {
    _writeText(gitignore, block);
    return true;
  }
  const text = _readText(gitignore);
  const pattern = new RegExp(
    _reEscape(GITIGNORE_BLOCK_START) + ".*?" + _reEscape(GITIGNORE_BLOCK_END) + "\\n?",
    "s"
  );
  let new_text;
  if (pattern.test(text)) {
    new_text = text.replace(pattern, () => block);
  } else {
    new_text = text;
    if (new_text && !new_text.endsWith("\n")) {
      new_text += "\n";
    }
    new_text += block;
  }
  if (new_text === text) {
    return false;
  }
  _writeText(gitignore, new_text);
  return true;
}
function _build_plan(project) {
  return {
    npm: _detect_npm(path17.join(project, "package.json")),
    composer: _detect_composer(path17.join(project, "composer.json")),
    symlinks_legacy: MANAGED_SYMLINKS.filter(
      (name) => _classify_symlink(path17.join(project, name)) === "legacy"
    ),
    symlinks_user: MANAGED_SYMLINKS.filter(
      (name) => _classify_symlink(path17.join(project, name)) === "user"
    ),
    state_file: _isFile2(path17.join(project, LEGACY_STATE_FILENAME)),
    settings_files: _detect_legacy_settings(project).map((p) => path17.relative(project, p)),
    empty_shell: _detect_empty_shell(project)
  };
}
function _plan_lines(plan) {
  const lines = [];
  if (plan.npm) {
    lines.push(`would remove ${PACKAGE_NAME_NPM} from package.json`);
  }
  if (plan.composer) {
    lines.push(`would remove ${PACKAGE_NAME_COMPOSER} from composer.json`);
  }
  for (const name of plan.symlinks_legacy) {
    lines.push(`would remove legacy symlink ${name}`);
  }
  for (const name of plan.symlinks_user) {
    lines.push(`would preserve user-managed ${name} (review manually)`);
  }
  if (plan.state_file) {
    lines.push(`would migrate ${LEGACY_STATE_FILENAME} \u2192 ${LEGACY_STATE_V1_FILENAME}`);
  }
  for (const rel of plan.settings_files) {
    lines.push(`would delete legacy config ${rel}`);
  }
  if (plan.empty_shell) {
    lines.push(`would remove empty ${LEGACY_AGENT_CONFIG_SHELL}/ shell`);
  }
  lines.push("would refresh .gitignore agent-config block");
  return lines;
}
function _format_dry_run(plan, out) {
  _print(out, "\u2139\uFE0F  legacy install detected \u2014 re-run without --dry-run to migrate:");
  for (const line of _plan_lines(plan)) {
    _print(out, `    - ${line}`);
  }
}
function _pending_actions(plan) {
  return Number(plan.npm) + Number(plan.composer) + plan.symlinks_legacy.length + plan.symlinks_user.length + Number(plan.state_file) + plan.settings_files.length + Number(plan.empty_shell);
}
function _format_check(plan, out) {
  const n = _pending_actions(plan);
  _print(
    out,
    `\u26A0\uFE0F  legacy install detected \u2014 ${n} pending action(s) (run \`agent-config migrate\` to apply, \`--dry-run\` to preview):`
  );
  for (const line of _plan_lines(plan)) {
    _print(out, `    - ${line}`);
  }
}
function _warn_on_major_mismatch(from_major, plan, out) {
  if (from_major === "4" && !plan.composer) {
    _print(
      out,
      "\u2139\uFE0F  --from 4 declared but no composer.json agent-config entry found; proceeding from the detected signals."
    );
  } else if (from_major === "5" && !plan.npm) {
    _print(
      out,
      "\u2139\uFE0F  --from 5 declared but no package.json agent-config entry found; proceeding from the detected signals."
    );
  }
}
function _apply(project, out, err) {
  const summary = [];
  if (_strip_npm_entry(path17.join(project, "package.json"))) {
    summary.push(`removed ${PACKAGE_NAME_NPM} from package.json`);
  }
  if (_strip_composer_entry(path17.join(project, "composer.json"))) {
    summary.push(`removed ${PACKAGE_NAME_COMPOSER} from composer.json`);
  }
  const [removed_links, preserved_links] = _purge_legacy_symlinks(project);
  for (const name of removed_links) {
    summary.push(`removed legacy symlink ${name}`);
  }
  for (const name of preserved_links) {
    summary.push(`preserved user-managed ${name} (review manually)`);
  }
  let state_summary;
  try {
    state_summary = _migrate_state_file(project);
  } catch (exc) {
    _print(err, `\u274C  state migration failed: ${exc.message}`);
    return 1;
  }
  if (state_summary) {
    summary.push(state_summary);
  }
  for (const rel of _delete_legacy_settings(project)) {
    summary.push(`deleted legacy config ${rel}`);
  }
  if (_remove_empty_shell(project)) {
    summary.push(`removed empty ${LEGACY_AGENT_CONFIG_SHELL}/ shell`);
  }
  if (_update_gitignore(project)) {
    summary.push(".gitignore agent-config block refreshed");
  }
  _print(out, "\u2705  migration complete:");
  for (const line of summary) {
    _print(out, `    - ${line}`);
  }
  _print(out, "\n    Next: review the diff and commit.");
  return 0;
}
function _parse(argv, out, err) {
  const prog = "agent-config migrate";
  const usage = `usage: ${prog} [-h] [--dry-run | --check] [--from {4,5}]
`;
  const emitError = (msg) => {
    err.write(usage);
    err.write(`${prog}: error: ${msg}
`);
    throw new ArgparseExit(2);
  };
  let dry_run = false;
  let check = false;
  let from_major = null;
  let i = 0;
  while (i < argv.length) {
    const tok = argv[i];
    if (tok === "-h" || tok === "--help") {
      out.write(usage);
      throw new ArgparseExit(0);
    } else if (tok === "--dry-run") {
      dry_run = true;
      i += 1;
    } else if (tok === "--check") {
      check = true;
      i += 1;
    } else if (tok === "--from") {
      const val = argv[i + 1];
      if (val === void 0) {
        emitError("argument --from: expected one argument");
        return { dry_run, check, from_major };
      }
      if (val !== "4" && val !== "5") {
        emitError(
          `argument --from: invalid choice: '${val}' (choose from '4', '5')`
        );
      }
      from_major = val;
      i += 2;
    } else if (tok.startsWith("--from=")) {
      const val = tok.slice("--from=".length);
      if (val !== "4" && val !== "5") {
        emitError(
          `argument --from: invalid choice: '${val}' (choose from '4', '5')`
        );
      }
      from_major = val;
      i += 1;
    } else {
      emitError(`unrecognized arguments: ${tok}`);
    }
  }
  if (dry_run && check) {
    emitError("argument --check: not allowed with argument --dry-run");
  }
  return { dry_run, check, from_major };
}
function main(argv = null, options = {}) {
  const out = options.out ?? _stdoutSink();
  const err = options.err ?? _stderrSink();
  const args = _parse(argv ?? process2.argv.slice(2), out, err);
  const [project] = resolve_project_root(null, { cwd: options.cwd ?? null });
  if (args.from_major) {
    _print(out, `\u2139\uFE0F  declared source major: ${args.from_major}.x`);
  }
  if (_detect_already_migrated(project)) {
    if (args.check) {
      _print(out, "\u2705  on the 6.0 layout \u2014 no migration needed.");
    } else {
      _print(out, "\u2705  already migrated \u2014 nothing to do.");
    }
    return 0;
  }
  const plan = _build_plan(project);
  _warn_on_major_mismatch(args.from_major, plan, out);
  if (args.check) {
    _format_check(plan, out);
    return 2;
  }
  if (args.dry_run) {
    _format_dry_run(plan, out);
    return 0;
  }
  return _apply(project, out, err);
}
var _inForeignBundle = !(typeof __AGENT_CONFIG_CLI_DELEGATE__ !== "undefined" && __AGENT_CONFIG_CLI_DELEGATE__);
var _HERE = fileURLToPath4(import.meta.url);
function _isCliEntry() {
  if (process2.argv[1] === void 0) {
    return false;
  }
  if (typeof __AGENT_CONFIG_CLI_DELEGATE__ !== "undefined" && __AGENT_CONFIG_CLI_DELEGATE__) {
    if (path17.basename(process2.argv[1], ".js") === "cmd_migrate") {
      return true;
    }
  }
  const argvUrl = pathToFileURL(path17.resolve(process2.argv[1])).href;
  if (import.meta.url === argvUrl) {
    return true;
  }
  try {
    const here = fs20.realpathSync(fileURLToPath4(import.meta.url));
    const argv = fs20.realpathSync(path17.resolve(process2.argv[1]));
    return here === argv;
  } catch {
    return false;
  }
}
if (!_inForeignBundle && (_isCliEntry() || process2.argv[1] === _HERE)) {
  try {
    process2.exitCode = main(process2.argv.slice(2));
  } catch (exc) {
    if (exc instanceof ArgparseExit) {
      process2.exitCode = exc.code;
    } else {
      throw exc;
    }
  }
}

// src/scripts/install.ts
var _HERE2 = fileURLToPath5(import.meta.url);
var SystemExitError = class extends Error {
  constructor(code) {
    super(`system-exit-${code}`);
    this.code = code;
  }
  code;
};
var ArgparseExit2 = class extends Error {
  constructor(code) {
    super(`argparse-exit-${code}`);
    this.code = code;
  }
  code;
};
function expanduser6(p) {
  if (p === "~") return os8.homedir();
  if (p.startsWith("~/") || p.startsWith("~\\")) {
    return path18.join(os8.homedir(), p.slice(2));
  }
  return p;
}
function resolvePath(p) {
  try {
    return fs21.realpathSync(path18.resolve(p));
  } catch {
    return path18.resolve(p);
  }
}
function isFile(p) {
  try {
    return fs21.statSync(p).isFile();
  } catch {
    return false;
  }
}
function isDir(p) {
  try {
    return fs21.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
function pathExists(p) {
  try {
    fs21.statSync(p);
    return true;
  } catch {
    return false;
  }
}
function isSymlink(p) {
  try {
    return fs21.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}
function readText(p) {
  return fs21.readFileSync(p, "utf-8");
}
function writeText(p, content) {
  fs21.writeFileSync(p, content, "utf-8");
}
function mkdirp(p) {
  fs21.mkdirSync(p, { recursive: true });
}
function sortedGlobStems(directory, suffix) {
  let entries;
  try {
    entries = fs21.readdirSync(directory);
  } catch {
    return [];
  }
  const stems = [];
  for (const name of entries) {
    if (name.endsWith(suffix)) {
      stems.push(name.slice(0, name.length - suffix.length));
    }
  }
  stems.sort((a, b) => {
    const fa = a + suffix;
    const fb = b + suffix;
    return fa < fb ? -1 : fa > fb ? 1 : 0;
  });
  return stems;
}
function countZips(directory) {
  if (!isDir(directory)) return 0;
  let n = 0;
  for (const name of fs21.readdirSync(directory)) {
    if (name.endsWith(".zip")) n += 1;
  }
  return n;
}
function sha256OfFile(p) {
  let data;
  try {
    data = fs21.readFileSync(p);
  } catch {
    return null;
  }
  return crypto3.createHash("sha256").update(data).digest("hex");
}
function atomicWrite0644(target, body, prefix) {
  const dir = path18.dirname(target);
  const tmpName = path18.join(
    dir,
    `${prefix}${process3.pid}.${crypto3.randomBytes(6).toString("hex")}.yml.tmp`
  );
  let fd = null;
  try {
    fd = fs21.openSync(tmpName, "wx", 420);
    fs21.writeFileSync(fd, body, "utf-8");
    fs21.closeSync(fd);
    fd = null;
    fs21.chmodSync(tmpName, 420);
    fs21.renameSync(tmpName, target);
  } catch (err) {
    if (fd !== null) {
      try {
        fs21.closeSync(fd);
      } catch {
      }
    }
    try {
      fs21.unlinkSync(tmpName);
    } catch {
    }
    throw err;
  }
}
function utcStamp(now) {
  const d = now ?? /* @__PURE__ */ new Date();
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`;
}
function _jsonStrNoAscii(s) {
  let out = '"';
  for (const ch of s) {
    const code = ch.codePointAt(0);
    switch (ch) {
      case '"':
        out += '\\"';
        break;
      case "\\":
        out += "\\\\";
        break;
      case "\n":
        out += "\\n";
        break;
      case "\r":
        out += "\\r";
        break;
      case "	":
        out += "\\t";
        break;
      case "\b":
        out += "\\b";
        break;
      case "\f":
        out += "\\f";
        break;
      default:
        if (code < 32) {
          out += "\\u" + code.toString(16).padStart(4, "0");
        } else {
          out += ch;
        }
    }
  }
  return out + '"';
}
function _jsonScalar(value) {
  if (value === null || value === void 0) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      if (Number.isNaN(value)) return "NaN";
      return value > 0 ? "Infinity" : "-Infinity";
    }
    return String(value);
  }
  if (typeof value === "string") return _jsonStrNoAscii(value);
  return null;
}
function _dumpIndent(value, indent, depth) {
  const scalar = _jsonScalar(value);
  if (scalar !== null) return scalar;
  const pad = " ".repeat(indent * (depth + 1));
  const closePad = " ".repeat(indent * depth);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((v) => pad + _dumpIndent(v, indent, depth + 1));
    return `[
${items.join(",\n")}
${closePad}]`;
  }
  if (typeof value === "object" && value !== null) {
    const obj = value;
    const keys = Object.keys(obj);
    if (keys.length === 0) return "{}";
    const items = keys.map(
      (k) => `${pad}${_jsonStrNoAscii(k)}: ${_dumpIndent(obj[k], indent, depth + 1)}`
    );
    return `{
${items.join(",\n")}
${closePad}}`;
  }
  return _jsonStrNoAscii(String(value));
}
function jsonDumpsIndent(value, indent) {
  return _dumpIndent(value, indent, 0);
}
function jsonDumpsCompact(value) {
  const scalar = _jsonScalar(value);
  if (scalar !== null) return scalar;
  if (Array.isArray(value)) {
    return "[" + value.map((v) => jsonDumpsCompact(v)).join(",") + "]";
  }
  if (typeof value === "object" && value !== null) {
    const obj = value;
    return "{" + Object.keys(obj).map((k) => `${_jsonStrNoAscii(k)}:${jsonDumpsCompact(obj[k])}`).join(",") + "}";
  }
  return _jsonStrNoAscii(String(value));
}
function yamlSafeLoad2(text) {
  let YAML3;
  try {
    YAML3 = require_dist();
  } catch {
    return null;
  }
  try {
    const data = YAML3.parse(text, { version: "1.1" });
    return data;
  } catch {
    return void 0;
  }
}
var DEFAULT_PROFILE = "balanced";
var SUPPORTED_PROFILES = ["minimal", "balanced", "full"];
var RULE_LOADING_TIER_PLACEHOLDER = "__RULE_LOADING_TIER__";
var USER_TYPE_PLACEHOLDER = "__USER_TYPE__";
var USER_TYPES_DIR = "user-types";
var SETTINGS_FILE = ".agent-settings.yml";
var LEGACY_SETTINGS_FILE = ".agent-settings";
var LEGACY_BACKUP_FILE = ".agent-settings.backup.key-value";
var SETTINGS_SUBDIR = ["agents", "settings"];
function _canonical_settings_target(project_root) {
  return path18.join(project_root, ...SETTINGS_SUBDIR, SETTINGS_FILE);
}
function _resolve_settings_read(project_root) {
  const canonical = _canonical_settings_target(project_root);
  if (pathExists(canonical)) return canonical;
  const legacy = path18.join(project_root, SETTINGS_FILE);
  if (pathExists(legacy)) return legacy;
  return canonical;
}
var LEGACY_RENAME_MAP = {
  cost_profile: "rule_loading_tier",
  ide: "personal.ide",
  open_edited_files: "personal.open_edited_files",
  user_name: "personal.user_name",
  rtk_installed: "personal.rtk_installed",
  minimal_output: "personal.minimal_output",
  play_by_play: "personal.play_by_play",
  pr_comment_bot_icon: "project.pr_comment_bot_icon",
  pr_template: "project.pr_template",
  upstream_repo: "project.upstream_repo",
  improvement_pr_branch_prefix: "project.improvement_pr_branch_prefix",
  github_pr_reply_method: "github.pr_reply_method",
  eloquent_access_style: "eloquent.access_style",
  skill_improvement_pipeline: "pipelines.skill_improvement",
  subagent_implementer_model: "subagents.implementer_model",
  subagent_judge_model: "subagents.judge_model",
  subagent_max_parallel: "subagents.max_parallel"
};
var state = {
  QUIET: false,
  PROGRESS_NDJSON: false
};
function _emit_progress(obj) {
  if (!state.PROGRESS_NDJSON) return;
  process3.stdout.write(jsonDumpsCompact(obj) + "\n");
}
function _emit_progress_terminal(rc) {
  if (!state.PROGRESS_NDJSON) return;
  if (rc === 0) {
    _emit_progress({ type: "done" });
  } else {
    _emit_progress({ type: "error", code: "E_INSTALL", exitCode: rc });
  }
}
function info(msg) {
  if (!state.QUIET) process3.stdout.write(`  ${msg}
`);
}
function success(msg) {
  if (!state.QUIET) process3.stdout.write(`  \u2705  ${msg}
`);
}
function skip(msg) {
  if (!state.QUIET) process3.stdout.write(`  \u23ED\uFE0F  ${msg}
`);
}
function warn(msg) {
  process3.stderr.write(`  \u26A0\uFE0F  ${msg}
`);
}
function fail(msg) {
  process3.stderr.write(`  \u274C  ${msg}
`);
  process3.stderr.write(
    "      Diagnose: `./agent-config doctor` (or `--check <id>` for a single category)\n"
  );
  throw new SystemExitError(1);
}
function detect_package_root(project_root) {
  const npm_path = path18.join(project_root, "node_modules", "@event4u", "agent-config");
  if (isDir(npm_path)) return resolvePath(npm_path);
  if (pathExists(path18.join(project_root, "src", "config", "profiles", "minimal.ini"))) {
    return project_root;
  }
  fail(
    "Could not find agent-config package. Install via `npx @event4u/agent-config init` or `npm install -g @event4u/agent-config`."
  );
}
function detect_package_type(package_root) {
  if (package_root.split(path18.sep).includes("node_modules")) return "npm";
  return "local";
}
function detect_package_type_for_project(project_root, package_root) {
  const npm_path = resolvePath(
    path18.join(project_root, "node_modules", "@event4u", "agent-config")
  );
  const package_resolved = resolvePath(package_root);
  if (package_resolved === npm_path) return "npm";
  return detect_package_type(package_root);
}
function _is_interactive() {
  try {
    return Boolean(process3.stdin.isTTY) && Boolean(process3.stdout.isTTY);
  } catch {
    return false;
  }
}
function _resolve_file_conflict(_target, _force_hint) {
  return "write";
}
function ensure_directory(p) {
  mkdirp(p);
}
function write_file(p, content) {
  ensure_directory(path18.dirname(p));
  writeText(p, content);
}
function read_json_file(p) {
  let data;
  try {
    data = JSON.parse(readText(p));
  } catch {
    warn(`Invalid JSON in ${p}, treating as empty`);
    return {};
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    warn(`Unexpected JSON shape in ${p}, treating as empty`);
    return {};
  }
  return data;
}
function write_json_file(p, data) {
  const content = jsonDumpsIndent(data, 4) + "\n";
  write_file(p, content);
}
function _isPlainObject2(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function deepcopy(v) {
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map((x) => deepcopy(x));
  const out = {};
  for (const k of Object.keys(v)) {
    out[k] = deepcopy(v[k]);
  }
  return out;
}
function deep_merge(base, overlay) {
  const result = deepcopy(base);
  for (const key of Object.keys(overlay)) {
    const value = overlay[key];
    if (Object.prototype.hasOwnProperty.call(result, key) && _isPlainObject2(result[key]) && _isPlainObject2(value)) {
      result[key] = deep_merge(
        result[key],
        value
      );
    } else {
      result[key] = deepcopy(value);
    }
  }
  return result;
}
function jsonEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => jsonEqual(v, b[i]));
  }
  if (_isPlainObject2(a) && _isPlainObject2(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every(
      (k) => Object.prototype.hasOwnProperty.call(b, k) && jsonEqual(a[k], b[k])
    );
  }
  return false;
}
function merge_json_file(p, new_data, _force, label) {
  const new_entries = build_merge_entries(label, new_data);
  if (!pathExists(p)) {
    write_json_file(p, new_data);
    success(`${label} created`);
    return new_entries;
  }
  const existing = read_json_file(p);
  const merged = deep_merge(existing, new_data);
  if (jsonEqual(merged, existing)) {
    skip(`${label} already configured`);
    return new_entries;
  }
  write_json_file(p, merged);
  success(`${label} updated`);
  return new_entries;
}
function _parse_legacy_settings(text) {
  const values = {};
  const unknown = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (!line.includes("=")) continue;
    const eq = line.indexOf("=");
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!key) continue;
    values[key] = value;
    if (!(key in LEGACY_RENAME_MAP)) unknown.push(key);
  }
  return [values, unknown];
}
var _BARE_ID_RE = /^[a-z][a-z0-9_]*$/;
function _yaml_scalar(value) {
  if (value === "") return '""';
  if (value === "true" || value === "false") return value;
  if (value.length > 0 && /^[0-9]+$/.test(value)) return value;
  if (_BARE_ID_RE.test(value)) return value;
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}
function _replace_template_value(template, dotted_path, value) {
  return _replace_template_value_raw(template, dotted_path, _yaml_scalar(value));
}
function _replace_template_value_raw(template, dotted_path, raw_yaml) {
  const parts = dotted_path.split(".");
  if (parts.length === 0) return template;
  const sections = parts.slice(0, parts.length - 1);
  const key = parts[parts.length - 1];
  const target_indent = "  ".repeat(sections.length);
  const header_re = /^(\s*)([A-Za-z_][A-Za-z0-9_]*):\s*$/;
  const scalar_re = /^(\s*)([A-Za-z_][A-Za-z0-9_]*):\s*\S.*$/;
  const current_path = new Array(sections.length).fill(null);
  const endsNl = template.endsWith("\n");
  const lines = template.split("\n");
  if (endsNl && lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx];
    const stripped = line.trim();
    if (!stripped || stripped.startsWith("#")) continue;
    const m_header = header_re.exec(line);
    if (m_header) {
      const indent2 = m_header[1];
      const name2 = m_header[2];
      const depth = Math.floor(indent2.length / 2);
      if (depth < sections.length) {
        current_path[depth] = name2;
        for (let d = depth + 1; d < sections.length; d += 1) {
          current_path[d] = null;
        }
      }
      continue;
    }
    const m_scalar = scalar_re.exec(line);
    if (!m_scalar) continue;
    const indent = m_scalar[1];
    const name = m_scalar[2];
    if (name !== key || indent !== target_indent) continue;
    if (!arrayEqual(current_path, sections)) continue;
    lines[idx] = `${indent}${key}: ${raw_yaml}`;
    return lines.join("\n") + (endsNl ? "\n" : "");
  }
  return template;
}
function arrayEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}
function _append_unknown_legacy(rendered, legacy_values, unknown_keys) {
  if (unknown_keys.length === 0) return rendered;
  const block = [
    "",
    "# Unknown keys from the legacy .agent-settings \u2014 review and drop.",
    "_legacy:"
  ];
  for (const key of [...unknown_keys].sort()) {
    block.push(`  ${key}: ${_yaml_scalar(legacy_values[key])}`);
  }
  const suffix = block.join("\n") + "\n";
  if (rendered.endsWith("\n")) return rendered + suffix;
  return rendered + "\n" + suffix;
}
function _migrate_legacy_if_present(project_root, template_body) {
  const legacy_target = path18.join(project_root, LEGACY_SETTINGS_FILE);
  if (!isFile(legacy_target)) return null;
  const legacy_text = readText(legacy_target);
  const [values, unknown] = _parse_legacy_settings(legacy_text);
  let rendered = template_body;
  for (const flat_key of Object.keys(values)) {
    if (flat_key in LEGACY_RENAME_MAP) {
      rendered = _replace_template_value(
        rendered,
        LEGACY_RENAME_MAP[flat_key],
        values[flat_key]
      );
    }
  }
  rendered = _append_unknown_legacy(rendered, values, unknown);
  const backup_target = path18.join(project_root, LEGACY_BACKUP_FILE);
  writeText(backup_target, legacy_text);
  fs21.unlinkSync(legacy_target);
  info(`Migrated legacy ${LEGACY_SETTINGS_FILE} \u2192 ${SETTINGS_FILE}`);
  info(`Backup saved to ${LEGACY_BACKUP_FILE}`);
  if (unknown.length > 0) {
    warn(`Legacy keys not in rename map preserved under _legacy: ${[...unknown].sort().join(", ")}`);
  }
  return rendered;
}
function _parse_profile_ini(p) {
  const values = {};
  for (const raw of readText(p).split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith(";") || line.startsWith("#")) continue;
    if (!line.includes("=")) continue;
    const eq = line.indexOf("=");
    values[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return values;
}
var _PLACEHOLDER_RE = /__[A-Z][A-Z0-9_]*__/g;
function _render_template(template, profile_values) {
  let body = template;
  for (const key of Object.keys(profile_values)) {
    const placeholder = `__${key.toUpperCase()}__`;
    if (body.includes(placeholder)) {
      body = body.split(placeholder).join(profile_values[key]);
    }
  }
  const leftover = [...new Set(body.match(_PLACEHOLDER_RE) ?? [])].sort();
  if (leftover.length > 0) {
    fail("Template has unfilled placeholders after profile render: " + leftover.join(", "));
  }
  return body;
}
function _load_valid_user_types(package_root) {
  const directory = path18.join(package_root, USER_TYPES_DIR);
  if (!isDir(directory)) return [];
  return sortedGlobStems(directory, ".yml");
}
function _validate_user_type(package_root, value) {
  const cleaned = (value || "").trim();
  if (!cleaned) return "";
  const valid = _load_valid_user_types(package_root);
  if (valid.length === 0) {
    fail(`--user-type=${cleaned} requested but no user-types/*.yml present under ${package_root}`);
  }
  if (!valid.includes(cleaned)) {
    fail(
      `Unknown --user-type=${cleaned}. Valid: ${valid.join(", ")} (empty string disables the filter).`
    );
  }
  return cleaned;
}
function _inject_packs(body, packs) {
  if (packs.length === 0) return body;
  const block = "packs:\n" + packs.map((p) => `  - ${p}
`).join("");
  const lines = splitlinesKeepends(body);
  const out = [];
  let inserted = false;
  for (const line of lines) {
    out.push(line);
    if (!inserted && line.startsWith("rule_loading_tier:")) {
      if (!line.endsWith("\n")) {
        out[out.length - 1] = line + "\n";
      }
      out.push(block);
      inserted = true;
    }
  }
  if (!inserted) {
    if (out.length > 0 && !out[out.length - 1].endsWith("\n")) {
      out[out.length - 1] = out[out.length - 1] + "\n";
    }
    out.push(block);
  }
  return out.join("");
}
function splitlinesKeepends(text) {
  const out = [];
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "\n") {
      out.push(text.slice(start, i + 1));
      start = i + 1;
    }
  }
  if (start < text.length) out.push(text.slice(start));
  return out;
}
function ensure_agent_settings(project_root, package_root, profile, force, user_type = "", packs = null) {
  const target = _canonical_settings_target(project_root);
  const profile_source = path18.join(package_root, "src", "config", "profiles", `${profile}.ini`);
  const template_source = path18.join(package_root, "src", "config", "agent-settings.template.yml");
  if (!pathExists(profile_source)) fail(`Missing profile preset: ${profile_source}`);
  if (!pathExists(template_source)) fail(`Missing settings template: ${template_source}`);
  const template = readText(template_source);
  if (!template.includes(RULE_LOADING_TIER_PLACEHOLDER)) {
    fail(`Template is missing placeholder ${RULE_LOADING_TIER_PLACEHOLDER}`);
  }
  if (!template.includes(USER_TYPE_PLACEHOLDER)) {
    fail(`Template is missing placeholder ${USER_TYPE_PLACEHOLDER}`);
  }
  const profile_values = _parse_profile_ini(profile_source);
  if (profile_values["rule_loading_tier"] !== profile) {
    const got = "rule_loading_tier" in profile_values ? `'${profile_values["rule_loading_tier"]}'` : "None";
    fail(
      `Profile preset ${path18.basename(profile_source)} has rule_loading_tier=${got} but --profile=${profile}`
    );
  }
  profile_values["user_type"] = _validate_user_type(package_root, user_type);
  let template_body = _render_template(template, profile_values);
  template_body = _inject_packs(template_body, packs ?? []);
  const legacy_root = path18.join(project_root, SETTINGS_FILE);
  if (isFile(legacy_root) && !pathExists(target)) {
    mkdirp(path18.dirname(target));
    writeText(target, readText(legacy_root));
    fs21.unlinkSync(legacy_root);
    success(`Migrated ${SETTINGS_FILE} \u2192 agents/settings/${SETTINGS_FILE} (ADR-038)`);
    return;
  }
  const legacy_target = path18.join(project_root, LEGACY_SETTINGS_FILE);
  if (isFile(legacy_target) && pathExists(target)) {
    warn(
      `Both ${SETTINGS_FILE} and legacy ${LEGACY_SETTINGS_FILE} exist. Skipping migration to avoid overwriting ${SETTINGS_FILE}. Delete one of them manually and re-run.`
    );
    return;
  }
  const migrated = _migrate_legacy_if_present(project_root, template_body);
  if (migrated !== null) {
    write_file(target, migrated);
    success(`${SETTINGS_FILE} migrated from legacy key=value`);
    return;
  }
  if (pathExists(target) && !force) {
    skip(`${SETTINGS_FILE} already exists`);
    return;
  }
  mkdirp(path18.dirname(target));
  write_file(target, template_body);
  const user_type_value = profile_values["user_type"] ?? "";
  const suffix = user_type_value ? `, user_type=${user_type_value}` : "";
  success(`${SETTINGS_FILE} created (rule_loading_tier=${profile}${suffix})`);
}
function ensure_vscode_bridge(project_root, package_type, force) {
  const plugin_paths = {
    npm: "./node_modules/@event4u/agent-config/plugin/agent-config"
  };
  const plugin_path = plugin_paths[package_type] ?? "./plugin/agent-config";
  const bridge = { "chat.pluginLocations": { [plugin_path]: true } };
  return merge_json_file(
    path18.join(project_root, ".vscode", "settings.json"),
    bridge,
    force,
    ".vscode/settings.json"
  );
}
function ensure_augment_bridge(project_root, force) {
  const bridge = { enabledPlugins: { "agent-config@event4u": true } };
  return merge_json_file(
    path18.join(project_root, ".augment", "settings.json"),
    bridge,
    force,
    ".augment/settings.json"
  );
}
var AUGMENT_USER_DIR = path18.join(os8.homedir(), ".augment");
var AUGMENT_USER_HOOKS_DIR = path18.join(AUGMENT_USER_DIR, "hooks");
var AUGMENT_DISPATCHER_TRAMPOLINE = "augment-dispatcher.sh";
var AUGMENT_LEGACY_TRAMPOLINES = [
  "augment-chat-history.sh",
  "augment-roadmap-progress.sh",
  "augment-onboarding-gate.sh",
  "augment-context-hygiene.sh"
];
var AUGMENT_DISPATCHER_BINDINGS = [
  ["session_start", "SessionStart"],
  ["session_end", "SessionEnd"],
  ["stop", "Stop"],
  ["pre_tool_use", "PreToolUse"],
  ["post_tool_use", "PostToolUse"]
];
function _deploy_augment_trampoline(package_root, name, force) {
  const src = path18.join(package_root, "scripts", "hooks", name);
  if (!pathExists(src)) {
    skip(`augment trampoline missing in package: ${src}`);
    return null;
  }
  mkdirp(AUGMENT_USER_HOOKS_DIR);
  const dst = path18.join(AUGMENT_USER_HOOKS_DIR, name);
  const src_text = readText(src);
  if (pathExists(dst) && readText(dst) === src_text && !force) {
    skip(`~/.augment/hooks/${name} already up to date`);
  } else {
    writeText(dst, src_text);
    fs21.chmodSync(dst, 493);
    success(`~/.augment/hooks/${name} installed`);
  }
  return dst;
}
function _remove_legacy_augment_trampolines() {
  for (const name of AUGMENT_LEGACY_TRAMPOLINES) {
    const legacy = path18.join(AUGMENT_USER_HOOKS_DIR, name);
    try {
      if (isFile(legacy)) {
        fs21.unlinkSync(legacy);
        skip(`removed legacy ~/.augment/hooks/${name}`);
      }
    } catch (err) {
      warn(`could not remove legacy ${legacy}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
function ensure_augment_user_hooks(package_root, force) {
  const dst = _deploy_augment_trampoline(package_root, AUGMENT_DISPATCHER_TRAMPOLINE, force);
  if (dst === null) return [];
  _remove_legacy_augment_trampolines();
  const per_event = {};
  for (const [ac_event, native] of AUGMENT_DISPATCHER_BINDINGS) {
    const cmd = `${dst} ${ac_event} ${native}`;
    const entry = { hooks: [{ type: "command", command: cmd }] };
    (per_event[native] ??= []).push(entry);
  }
  const settings_patch = { hooks: per_event };
  return merge_json_file(
    path18.join(AUGMENT_USER_DIR, "settings.json"),
    settings_patch,
    force,
    "~/.augment/settings.json"
  );
}
var CLAUDE_PLUGIN_ID = "agent-config@event4u-agent-config";
var CLAUDE_LEGACY_PLUGIN_IDS = [
  "agent-conf@event4u",
  "agent-config@event4u"
];
function _heal_legacy_claude_plugin_ids(p) {
  if (!pathExists(p)) return [];
  const data = read_json_file(p);
  const enabled = data["enabledPlugins"];
  if (!_isPlainObject2(enabled)) return [];
  const removed = CLAUDE_LEGACY_PLUGIN_IDS.filter((pid) => pid in enabled);
  if (removed.length === 0) return [];
  for (const pid of removed) {
    delete enabled[pid];
  }
  write_json_file(p, data);
  return removed;
}
function ensure_claude_bridge(project_root, force) {
  const target = path18.join(project_root, ".claude", "settings.json");
  const healed = _heal_legacy_claude_plugin_ids(target);
  for (const pid of healed) {
    success(`.claude/settings.json: removed stale plugin id \`${pid}\``);
  }
  const bridge = { enabledPlugins: { [CLAUDE_PLUGIN_ID]: true } };
  return merge_json_file(target, bridge, force || healed.length > 0, ".claude/settings.json");
}
var CURSOR_DISPATCHER_BINDINGS = [
  ["session_start", "sessionStart"],
  ["session_end", "sessionEnd"],
  ["stop", "stop"],
  ["user_prompt_submit", "beforeSubmitPrompt"],
  ["post_tool_use", "postToolUse"]
];
function _cursor_dispatch_command(ac_event, native) {
  return `[ -x ./agent-config ] || exit 0; ./agent-config dispatch:hook --platform cursor --event ${ac_event} --native-event ${native}`;
}
function ensure_cursor_bridge(project_root, force) {
  const hooks = {};
  for (const [ac_event, native] of CURSOR_DISPATCHER_BINDINGS) {
    (hooks[native] ??= []).push({ command: _cursor_dispatch_command(ac_event, native) });
  }
  const bridge = { version: 1, hooks };
  return merge_json_file(
    path18.join(project_root, ".cursor", "hooks.json"),
    bridge,
    force,
    ".cursor/hooks.json"
  );
}
var CURSOR_USER_DIR = path18.join(os8.homedir(), ".cursor");
var CURSOR_USER_HOOKS_DIR = path18.join(CURSOR_USER_DIR, "hooks");
var CURSOR_DISPATCHER_TRAMPOLINE = "cursor-dispatcher.sh";
function ensure_cursor_user_hooks(package_root, force) {
  const src = path18.join(package_root, "scripts", "hooks", CURSOR_DISPATCHER_TRAMPOLINE);
  if (!pathExists(src)) {
    skip(`cursor trampoline missing in package: ${src}`);
    return [];
  }
  mkdirp(CURSOR_USER_HOOKS_DIR);
  const dst = path18.join(CURSOR_USER_HOOKS_DIR, CURSOR_DISPATCHER_TRAMPOLINE);
  const src_text = readText(src);
  if (pathExists(dst) && readText(dst) === src_text && !force) {
    skip(`~/.cursor/hooks/${CURSOR_DISPATCHER_TRAMPOLINE} already up to date`);
  } else {
    writeText(dst, src_text);
    fs21.chmodSync(dst, 493);
    success(`~/.cursor/hooks/${CURSOR_DISPATCHER_TRAMPOLINE} installed`);
  }
  const hooks = {};
  for (const [ac_event, native] of CURSOR_DISPATCHER_BINDINGS) {
    (hooks[native] ??= []).push({ command: `${dst} ${ac_event} ${native}` });
  }
  const settings_patch = { version: 1, hooks };
  return merge_json_file(
    path18.join(CURSOR_USER_DIR, "hooks.json"),
    settings_patch,
    force,
    "~/.cursor/hooks.json"
  );
}
var CLINE_DISPATCHER_BINDINGS = [
  ["session_start", "TaskStart"],
  ["session_start", "TaskResume"],
  ["session_end", "TaskComplete"],
  ["stop", "TaskCancel"],
  ["user_prompt_submit", "UserPromptSubmit"],
  ["post_tool_use", "PostToolUse"]
];
function shlexQuote(s) {
  if (s === "") return "''";
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(s)) return s;
  return "'" + s.replace(/'/g, `'"'"'`) + "'";
}
function clineProjectHookBody(native_event, ac_event, workspace_quoted) {
  return `#!/usr/bin/env bash
# Generated by event4u/agent-config install.py \u2014 DO NOT EDIT.
# Project-scope Cline hook for ${native_event} \u2192 agent-config ${ac_event}.
# Phase 7.6 (docs/contracts/hook-architecture-v1.md).
set -u
EVENT_DATA="$(cat)"
WORKSPACE_ROOT=${workspace_quoted}
cd "$WORKSPACE_ROOT" 2>/dev/null || { printf '%s\\n' '{}'; exit 0; }
if [ ! -x ./agent-config ]; then
    printf '%s\\n' '{}'
    exit 0
fi
printf '%s' "$EVENT_DATA" \\
    | ./agent-config dispatch:hook \\
        --platform cline \\
        --event ${ac_event} \\
        --native-event ${native_event} \\
        >/dev/null 2>&1 || true
printf '%s\\n' '{}'
exit 0
`;
}
function ensure_cline_bridge(project_root, force) {
  const hooks_dir = path18.join(project_root, ".clinerules", "hooks");
  mkdirp(hooks_dir);
  const workspace_quoted = shlexQuote(resolvePath(project_root));
  let written = 0;
  for (const [ac_event, native_event] of CLINE_DISPATCHER_BINDINGS) {
    const target = path18.join(hooks_dir, native_event);
    const body = clineProjectHookBody(native_event, ac_event, workspace_quoted);
    if (pathExists(target) && readText(target) === body && !force) {
      continue;
    }
    if (pathExists(target) && !force) {
      skip(`.clinerules/hooks/${native_event} exists, needs update (use --force)`);
      continue;
    }
    writeText(target, body);
    fs21.chmodSync(target, 493);
    written += 1;
  }
  if (written) {
    success(`.clinerules/hooks/ \u2014 ${written} script(s) installed`);
  } else {
    skip(".clinerules/hooks/ already up to date");
  }
}
var CLINE_USER_DIR = path18.join(os8.homedir(), "Documents", "Cline", "Hooks");
var CLINE_DISPATCHER_TRAMPOLINE = "cline-dispatcher.sh";
function ensure_cline_user_hooks(package_root, force) {
  const src = path18.join(package_root, "scripts", "hooks", CLINE_DISPATCHER_TRAMPOLINE);
  if (!pathExists(src)) {
    skip(`cline trampoline missing in package: ${src}`);
    return;
  }
  mkdirp(CLINE_USER_DIR);
  const trampoline = path18.join(CLINE_USER_DIR, CLINE_DISPATCHER_TRAMPOLINE);
  const src_text = readText(src);
  if (pathExists(trampoline) && readText(trampoline) === src_text && !force) {
    skip(`~/Documents/Cline/Hooks/${CLINE_DISPATCHER_TRAMPOLINE} already up to date`);
  } else {
    writeText(trampoline, src_text);
    fs21.chmodSync(trampoline, 493);
    success(`~/Documents/Cline/Hooks/${CLINE_DISPATCHER_TRAMPOLINE} installed`);
  }
  const trampoline_quoted = shlexQuote(trampoline);
  for (const [ac_event, native_event] of CLINE_DISPATCHER_BINDINGS) {
    const wrapper = path18.join(CLINE_USER_DIR, native_event);
    const body = `#!/usr/bin/env bash
# Generated by event4u/agent-config install.py \u2014 DO NOT EDIT.
# User-scope Cline hook for ${native_event} \u2192 agent-config ${ac_event}.
exec ${trampoline_quoted} ${ac_event} ${native_event}
`;
    if (pathExists(wrapper) && readText(wrapper) === body && !force) {
      continue;
    }
    writeText(wrapper, body);
    fs21.chmodSync(wrapper, 493);
  }
}
var WINDSURF_DISPATCHER_BINDINGS = [
  ["session_start", "post_setup_worktree"],
  ["user_prompt_submit", "pre_user_prompt"],
  ["stop", "post_cascade_response"]
];
function _windsurf_dispatch_command(ac_event, native) {
  return `[ -x ./agent-config ] || exit 0; ./agent-config dispatch:hook --platform windsurf --event ${ac_event} --native-event ${native}`;
}
function ensure_windsurf_bridge(project_root, force) {
  const hooks = {};
  for (const [ac_event, native] of WINDSURF_DISPATCHER_BINDINGS) {
    (hooks[native] ??= []).push({
      command: _windsurf_dispatch_command(ac_event, native),
      show_output: false
    });
  }
  const bridge = { hooks };
  return merge_json_file(
    path18.join(project_root, ".windsurf", "hooks.json"),
    bridge,
    force,
    ".windsurf/hooks.json"
  );
}
var WINDSURF_USER_DIR = path18.join(os8.homedir(), ".codeium", "windsurf");
var WINDSURF_USER_HOOKS_DIR = path18.join(WINDSURF_USER_DIR, "hooks");
var WINDSURF_DISPATCHER_TRAMPOLINE = "windsurf-dispatcher.sh";
function ensure_windsurf_user_hooks(package_root, force) {
  const src = path18.join(package_root, "scripts", "hooks", WINDSURF_DISPATCHER_TRAMPOLINE);
  if (!pathExists(src)) {
    skip(`windsurf trampoline missing in package: ${src}`);
    return [];
  }
  mkdirp(WINDSURF_USER_HOOKS_DIR);
  const dst = path18.join(WINDSURF_USER_HOOKS_DIR, WINDSURF_DISPATCHER_TRAMPOLINE);
  const src_text = readText(src);
  if (pathExists(dst) && readText(dst) === src_text && !force) {
    skip(`~/.codeium/windsurf/hooks/${WINDSURF_DISPATCHER_TRAMPOLINE} already up to date`);
  } else {
    writeText(dst, src_text);
    fs21.chmodSync(dst, 493);
    success(`~/.codeium/windsurf/hooks/${WINDSURF_DISPATCHER_TRAMPOLINE} installed`);
  }
  const hooks = {};
  for (const [ac_event, native] of WINDSURF_DISPATCHER_BINDINGS) {
    (hooks[native] ??= []).push({
      command: `${dst} ${ac_event} ${native}`,
      show_output: false
    });
  }
  const settings_patch = { hooks };
  return merge_json_file(
    path18.join(WINDSURF_USER_DIR, "hooks.json"),
    settings_patch,
    force,
    "~/.codeium/windsurf/hooks.json"
  );
}
var GEMINI_DISPATCHER_BINDINGS = [
  ["session_start", "SessionStart", ""],
  ["session_end", "SessionEnd", ""],
  ["stop", "AfterAgent", ""],
  ["user_prompt_submit", "BeforeAgent", ""],
  ["post_tool_use", "AfterTool", ".*"]
];
function _gemini_dispatch_command(ac_event, native) {
  return `[ -x ./agent-config ] || exit 0; ./agent-config dispatch:hook --platform gemini --event ${ac_event} --native-event ${native}`;
}
function _gemini_hooks_dict(command_factory) {
  const out = {};
  for (const [ac_event, native, matcher] of GEMINI_DISPATCHER_BINDINGS) {
    (out[native] ??= []).push({
      matcher,
      hooks: [{ type: "command", command: command_factory(ac_event, native) }]
    });
  }
  return out;
}
function ensure_gemini_bridge(project_root, force) {
  const bridge = { hooks: _gemini_hooks_dict(_gemini_dispatch_command) };
  return merge_json_file(
    path18.join(project_root, ".gemini", "settings.json"),
    bridge,
    force,
    ".gemini/settings.json"
  );
}
var GEMINI_USER_DIR = path18.join(os8.homedir(), ".gemini");
var GEMINI_USER_HOOKS_DIR = path18.join(GEMINI_USER_DIR, "hooks");
var GEMINI_DISPATCHER_TRAMPOLINE = "gemini-dispatcher.sh";
function ensure_gemini_user_hooks(package_root, force) {
  const src = path18.join(package_root, "scripts", "hooks", GEMINI_DISPATCHER_TRAMPOLINE);
  if (!pathExists(src)) {
    skip(`gemini trampoline missing in package: ${src}`);
    return [];
  }
  mkdirp(GEMINI_USER_HOOKS_DIR);
  const dst = path18.join(GEMINI_USER_HOOKS_DIR, GEMINI_DISPATCHER_TRAMPOLINE);
  const src_text = readText(src);
  if (pathExists(dst) && readText(dst) === src_text && !force) {
    skip(`~/.gemini/hooks/${GEMINI_DISPATCHER_TRAMPOLINE} already up to date`);
  } else {
    writeText(dst, src_text);
    fs21.chmodSync(dst, 493);
    success(`~/.gemini/hooks/${GEMINI_DISPATCHER_TRAMPOLINE} installed`);
  }
  const settings_patch = {
    hooks: _gemini_hooks_dict((ac_event, native) => `${dst} ${ac_event} ${native}`)
  };
  return merge_json_file(
    path18.join(GEMINI_USER_DIR, "settings.json"),
    settings_patch,
    force,
    "~/.gemini/settings.json"
  );
}
function ensure_copilot_bridge(project_root, force) {
  const target = path18.join(project_root, ".github", "plugin", "marketplace.json");
  const bridge = {
    marketplace: {
      name: "event4u-agent-marketplace",
      plugins: [
        {
          id: "agent-config@event4u",
          repository: "https://github.com/event4u-app/agent-config"
        }
      ]
    }
  };
  if (pathExists(target) && !force) {
    skip(".github/plugin/marketplace.json already exists");
    return;
  }
  write_json_file(target, bridge);
  success(".github/plugin/marketplace.json created");
}
var ROOCODE_MARKER = `# Agent Config bridge

This file marks the project as an \`event4u/agent-config\` consumer.

Roo Code reads \`.roo/rules/*.md\` as system-level instructions. The
canonical rule and skill source lives under \`.augment/\` (Augment
portability mirror \u2014 see \`AGENTS.md\` for orientation).

## How to use

- These rules load automatically on every Roo Code session \u2014 no
  manual action required.
- Switch Roo Code modes (Architect / Code / Ask / Debug / Custom)
  via the mode switcher to invoke different cognition profiles;
  every mode still sees these rules.
- Slash commands and skills live under \`.augment/commands/\` and
  \`.augment/skills/\`. Roo Code does not register them natively \u2014
  invoke them by name in chat (e.g. *"run the create-pr command"*).

See \`docs/setup/per-ide/roocode.md\` for the full activation guide.

Run \`./agent-config --help\` for available commands.
`;
function ensure_roocode_bridge(project_root, force) {
  const target = path18.join(project_root, ".roo", "rules", "agent-config.md");
  if (pathExists(target) && !force) {
    skip(".roo/rules/agent-config.md already exists");
    return;
  }
  write_file(target, ROOCODE_MARKER);
  success(".roo/rules/agent-config.md created");
}
var CLAUDE_DESKTOP_MARKER = `# Agent Config bridge \u2014 Claude Desktop

This file marks the project as an \`event4u/agent-config\` consumer.

Claude Desktop is a **global-scope** tool \u2014 it reads config from
\`~/Library/Application Support/Claude/\` (macOS) and does not
auto-discover project files. This marker is informational only.

To wire Claude Desktop to this project's rules, run:
\`npx @event4u/agent-config init --ai claude-desktop --global\`

Canonical rule and skill source: \`.augment/\` (see \`AGENTS.md\`).
`;
function ensure_claude_desktop_bridge(project_root, force) {
  const target = path18.join(project_root, ".claude-desktop", "agent-config.md");
  if (pathExists(target) && !force) {
    skip(".claude-desktop/agent-config.md already exists");
    return;
  }
  write_file(target, CLAUDE_DESKTOP_MARKER);
  success(".claude-desktop/agent-config.md created");
}
var AIDER_MARKER = `# Agent Config bridge \u2014 Aider

This file marks the project as an \`event4u/agent-config\` consumer.

Aider does not auto-discover this file. To activate it, add the
following to \`.aider.conf.yml\` (create if missing):

\`\`\`yaml
read:
  - .aider/agent-config.md
\`\`\`

Or pass \`--read .aider/agent-config.md\` on the command line.

Canonical rule and skill source: \`.augment/\` (see \`AGENTS.md\`).
`;
function ensure_aider_bridge(project_root, force) {
  const target = path18.join(project_root, ".aider", "agent-config.md");
  if (pathExists(target) && !force) {
    skip(".aider/agent-config.md already exists");
    return;
  }
  write_file(target, AIDER_MARKER);
  success(".aider/agent-config.md created");
}
var CODEX_MARKER = `# Agent Config bridge \u2014 Codex CLI

This file marks the project as an \`event4u/agent-config\` consumer.

Codex CLI auto-discovers \`AGENTS.md\` at the project root \u2014 that file
is the canonical entry point. This marker is informational and tells
developers where the rules and skills live.

Canonical rule and skill source: \`.augment/\` (see project \`AGENTS.md\`).
`;
function ensure_codex_bridge(project_root, force) {
  const target = path18.join(project_root, ".codex", "agent-config.md");
  if (pathExists(target) && !force) {
    skip(".codex/agent-config.md already exists");
    return;
  }
  write_file(target, CODEX_MARKER);
  success(".codex/agent-config.md created");
}
var CONTINUE_MARKER = `# Agent Config bridge \u2014 Continue.dev

This file marks the project as an \`event4u/agent-config\` consumer.

Continue.dev auto-discovers \`.continue/rules/*.md\` as system-level
rules per session. The canonical rule and skill source lives under
\`.augment/\` (Augment portability mirror \u2014 see \`AGENTS.md\` for
orientation).
`;
function ensure_continue_bridge(project_root, force) {
  const target = path18.join(project_root, ".continue", "rules", "agent-config.md");
  if (pathExists(target) && !force) {
    skip(".continue/rules/agent-config.md already exists");
    return;
  }
  write_file(target, CONTINUE_MARKER);
  success(".continue/rules/agent-config.md created");
}
var KILOCODE_MARKER = `# Agent Config bridge \u2014 Kilo Code

This file marks the project as an \`event4u/agent-config\` consumer.

Kilo Code auto-discovers \`.kilocode/rules/*.md\` as system-level rules
per session. The canonical rule and skill source lives under
\`.augment/\` (Augment portability mirror \u2014 see \`AGENTS.md\` for
orientation).

## How to use

- These rules load automatically on every Kilo Code session \u2014 no
  manual action required.
- Switch Kilo Code modes (Architect / Code / Ask / Debug /
  Orchestrator) via the mode switcher to invoke different
  cognition profiles; every mode still sees these rules.
- Slash commands and skills live under \`.augment/commands/\` and
  \`.augment/skills/\`. Kilo Code does not register them natively \u2014
  invoke them by name in chat (e.g. *"run the create-pr command"*).

See \`docs/setup/per-ide/kilocode.md\` for the full activation guide.
`;
function ensure_kilocode_bridge(project_root, force) {
  const target = path18.join(project_root, ".kilocode", "rules", "agent-config.md");
  if (pathExists(target) && !force) {
    skip(".kilocode/rules/agent-config.md already exists");
    return;
  }
  write_file(target, KILOCODE_MARKER);
  success(".kilocode/rules/agent-config.md created");
}
var ZED_MARKER = `# Agent Config bridge \u2014 Zed

This file marks the project as an \`event4u/agent-config\` consumer.

Zed reads \`.rules\` at the project root as system-level instructions \u2014
that file is the canonical entry point. This marker is informational
and tells developers where the rules and skills live.

To activate agent-config under Zed, point Zed's \`.rules\` at the
canonical source (or symlink it):

\`\`\`
# Append to .rules at project root
@.augment/AGENTS.md
\`\`\`

Canonical rule and skill source: \`.augment/\` (see \`AGENTS.md\`).
`;
function ensure_zed_bridge(project_root, force) {
  const target = path18.join(project_root, ".zed", "agent-config.md");
  if (pathExists(target) && !force) {
    skip(".zed/agent-config.md already exists");
    return;
  }
  write_file(target, ZED_MARKER);
  success(".zed/agent-config.md created");
}
var JETBRAINS_MARKER = `# Agent Config bridge \u2014 JetBrains AI Assistant

This file marks the project as an \`event4u/agent-config\` consumer.

JetBrains AI Assistant reads custom prompts and guidelines from
project-level config (\`.idea/\`) and user-scope settings. This marker
is informational \u2014 to wire agent-config into JetBrains AI, point the
assistant's custom-prompts path at \`.augment/\` or copy the relevant
rules into your JetBrains profile.

Canonical rule and skill source: \`.augment/\` (see \`AGENTS.md\`).
`;
function ensure_jetbrains_bridge(project_root, force) {
  const target = path18.join(project_root, ".jetbrains", "agent-config.md");
  if (pathExists(target) && !force) {
    skip(".jetbrains/agent-config.md already exists");
    return;
  }
  write_file(target, JETBRAINS_MARKER);
  success(".jetbrains/agent-config.md created");
}
var KIRO_MARKER = `# Agent Config bridge \u2014 Kiro

This file marks the project as an \`event4u/agent-config\` consumer.

Kiro auto-discovers \`.kiro/steering/*.md\` as steering documents per
session. The canonical rule and skill source lives under \`.augment/\`
(Augment portability mirror \u2014 see \`AGENTS.md\` for orientation).

## How to use

- Steering documents load automatically on every Kiro session \u2014 no
  manual action required.
- For structured, plan-first work, use Kiro's **Spec** workflow
  (the agent produces a spec \u2192 tasks \u2192 implementation under your
  review). For free-form work, use **Vibe**. Both honor these
  steering documents.
- Slash commands and skills live under \`.augment/commands/\` and
  \`.augment/skills/\`. Kiro does not register them natively \u2014
  invoke them by name in chat (e.g. *"run the create-pr command"*).

See \`docs/setup/per-ide/kiro.md\` for the full activation guide.
`;
function ensure_kiro_bridge(project_root, force) {
  const target = path18.join(project_root, ".kiro", "steering", "agent-config.md");
  if (pathExists(target) && !force) {
    skip(".kiro/steering/agent-config.md already exists");
    return;
  }
  write_file(target, KIRO_MARKER);
  success(".kiro/steering/agent-config.md created");
}
var SMOKE_PROBE_EVENTS = [
  ["augment", "session_start"],
  ["claude", "SessionStart"],
  ["cursor", "beforeShellExecution"],
  ["cline", "session_start"],
  ["windsurf", "post_setup_worktree"],
  ["gemini", "SessionStart"]
];
var SMOKE_BRIDGE_PATHS = {
  augment: ".augment/settings.json",
  claude: ".claude/settings.json",
  cursor: ".cursor/hooks.json",
  cline: ".clinerules/hooks",
  windsurf: ".windsurf/hooks.json",
  gemini: ".gemini/settings.json"
};
function dirHasEntries(p) {
  try {
    return fs21.readdirSync(p).length > 0;
  } catch {
    return false;
  }
}
function _resolve_tsx_invocation(scriptPath, scriptArgs) {
  const binName = process3.platform === "win32" ? "tsx.cmd" : "tsx";
  let dir = path18.dirname(scriptPath);
  for (; ; ) {
    const candidate = path18.join(dir, "node_modules", ".bin", binName);
    if (isFile(candidate)) {
      return { command: candidate, args: [scriptPath, ...scriptArgs] };
    }
    const parent = path18.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return { command: "npx", args: ["tsx", scriptPath, ...scriptArgs] };
}
function _smoke_test_hooks(project_root, package_root) {
  const dispatcher = path18.join(package_root, "scripts", "hooks", "dispatch_hook.ts");
  const manifest = path18.join(package_root, "scripts", "hook_manifest.yaml");
  if (!isFile(dispatcher) || !isFile(manifest)) return 0;
  const failed = [];
  const skipped = [];
  const passed = [];
  for (const [platform, native] of SMOKE_PROBE_EVENTS) {
    const rel_bridge = SMOKE_BRIDGE_PATHS[platform] ?? "";
    const bridge_path = rel_bridge ? path18.join(project_root, rel_bridge) : null;
    const bridge_present = Boolean(
      bridge_path && (isFile(bridge_path) || isDir(bridge_path) && dirHasEntries(bridge_path))
    );
    if (!bridge_present) {
      skipped.push(platform);
      continue;
    }
    const dispatcherArgs = [
      "--manifest",
      manifest,
      "--platform",
      platform,
      "--event",
      "session_start",
      "--native-event",
      native,
      "--dry-run"
    ];
    const inv = _resolve_tsx_invocation(dispatcher, dispatcherArgs);
    let res;
    try {
      res = spawnSync2(inv.command, inv.args, {
        input: "{}",
        encoding: "utf-8",
        cwd: project_root,
        timeout: 1e4
      });
    } catch (exc) {
      failed.push(`${platform}: ${String(exc)}`);
      continue;
    }
    if (res.error) {
      failed.push(`${platform}: ${String(res.error)}`);
      continue;
    }
    const returncode = res.status ?? 1;
    if (returncode !== 0) {
      const errTail = (res.stderr || "").trim().slice(0, 120);
      failed.push(`${platform}: exit=${returncode} ${errTail}`);
      continue;
    }
    let plan;
    try {
      plan = JSON.parse(res.stdout || "{}");
    } catch {
      failed.push(`${platform}: dispatcher did not emit JSON plan`);
      continue;
    }
    const concerns = _isPlainObject2(plan) ? plan["concerns"] : void 0;
    if (!Array.isArray(concerns)) {
      failed.push(`${platform}: plan.concerns missing or not a list`);
      continue;
    }
    passed.push(platform);
  }
  if (!state.QUIET) {
    if (passed.length) success(`hook smoke passed: ${passed.join(", ")}`);
    if (skipped.length) skip(`hook smoke skipped (bridge not installed): ${skipped.join(", ")}`);
    for (const line of failed) warn(`hook smoke failed \u2014 ${line}`);
  }
  return failed.length ? 1 : 0;
}
var USER_SCOPE_PATHS = {
  "claude-code": "~/.claude/",
  "claude-desktop": "~/Library/Application Support/Claude/",
  cursor: "~/.cursor/",
  windsurf: "~/.codeium/windsurf/",
  cline: "~/Documents/Cline/Rules/",
  "gemini-cli": "~/.gemini/",
  copilot: "~/.copilot/",
  augment: "~/.augment/",
  aider: "~/.aider.conf.yml",
  codex: "~/.codex/",
  roocode: "~/.roo/",
  continue: "~/.continue/",
  kilocode: "~/.kilocode/",
  zed: "~/.config/zed/",
  jetbrains: "~/.config/JetBrains/",
  kiro: "~/.kiro/",
  qoder: "~/.qoder/",
  opencode: "~/.opencode/",
  trae: "~/.trae/",
  antigravity: "~/.agents/",
  codebuddy: "~/.codebuddy/",
  droid: "~/.factory/",
  warp: "~/.warp/"
};
var SCOPE_SUPPORT = {
  "claude-code": "global",
  "claude-desktop": "global",
  cursor: "global",
  windsurf: "global",
  cline: "global",
  "gemini-cli": "global",
  copilot: "both",
  augment: "global",
  aider: "global",
  codex: "global",
  roocode: "global",
  continue: "global",
  kilocode: "global",
  zed: "global",
  jetbrains: "global",
  kiro: "global",
  qoder: "global",
  opencode: "global",
  trae: "global",
  antigravity: "global",
  codebuddy: "global",
  droid: "global",
  warp: "global"
};
var PROJECT_BRIDGE_MARKERS = {
  "claude-code": ".claude/settings.json",
  "claude-desktop": ".claude-desktop/agent-config.md",
  cursor: ".cursor/hooks.json",
  windsurf: ".windsurf/hooks.json",
  cline: ".clinerules/hooks",
  "gemini-cli": ".gemini/settings.json",
  copilot: ".github/plugin/marketplace.json",
  augment: ".augment/settings.json",
  aider: ".aider/agent-config.md",
  codex: ".codex/agent-config.md",
  roocode: ".roo/rules/agent-config.md",
  continue: ".continue/rules/agent-config.md",
  kilocode: ".kilocode/rules/agent-config.md",
  zed: ".zed/agent-config.md",
  jetbrains: ".jetbrains/agent-config.md",
  kiro: ".kiro/steering/agent-config.md"
};
var _CLAUDE_SKILL_BUNDLE = [
  ["dist/agent-src/rules", "rules"],
  ["dist/agent-src/skills", "skills"],
  ["dist/agent-src/commands", "commands"],
  ["dist/agent-src/personas", "personas"]
];
var GLOBAL_DEPLOY_SOURCES = {
  "claude-code": _CLAUDE_SKILL_BUNDLE,
  augment: [
    ["dist/agent-src/rules", "rules"],
    ["dist/agent-src/skills", "skills"],
    ["dist/agent-src/commands", "commands"],
    ["dist/agent-src/contexts", "contexts"],
    ["dist/agent-src/personas", "personas"],
    ["dist/agent-src/templates", "templates"]
  ],
  cursor: [
    ["dist/agent-src/rules", "rules"],
    ["dist/agent-src/commands", "commands"],
    ["dist/agent-src/personas", "personas"]
  ],
  windsurf: [["dist/agent-src/rules", "rules"]],
  cline: [["dist/agent-src/rules", ""]],
  "gemini-cli": _CLAUDE_SKILL_BUNDLE,
  codex: _CLAUDE_SKILL_BUNDLE,
  continue: _CLAUDE_SKILL_BUNDLE,
  roocode: _CLAUDE_SKILL_BUNDLE,
  kilocode: _CLAUDE_SKILL_BUNDLE,
  qoder: _CLAUDE_SKILL_BUNDLE,
  opencode: _CLAUDE_SKILL_BUNDLE,
  trae: _CLAUDE_SKILL_BUNDLE,
  antigravity: _CLAUDE_SKILL_BUNDLE,
  codebuddy: _CLAUDE_SKILL_BUNDLE,
  droid: _CLAUDE_SKILL_BUNDLE,
  warp: _CLAUDE_SKILL_BUNDLE,
  kiro: [
    ["dist/agent-src/rules", "rules"],
    ["dist/agent-src/skills", "steering"],
    ["dist/agent-src/personas", "personas"]
  ]
};
function claudeDesktopMarkerBody(lockfile, anchor, bundles_dir, bundle_count) {
  return `# agent-config \u2014 Claude Desktop marker

Installed by \`@event4u/agent-config\` (user scope, ADR-007).

- Lockfile:    \`${lockfile}\`
- Anchor:      \`${anchor}\`
- Skill bundles: \`${bundles_dir}\` (${bundle_count} ZIPs)

## Import skills into Claude Desktop

Claude Desktop has no filesystem skill-discovery convention \u2014 skills are
imported manually via the Customize \u2192 Skills UI.

1. Open Claude Desktop \u2192 **Settings \u2192 Customize \u2192 Skills**.
2. Click the **Upload skill** button.
3. Browse to \`${bundles_dir}\` and pick the \`<skill-name>.zip\` files you
   want to install. One ZIP = one skill.
4. Repeat per skill. Claude Desktop keeps each upload until you remove it.

The bundle directory is regenerated on every
\`npx @event4u/agent-config init --tools=claude-desktop\` run (only
changed skills are rewritten \u2014 content-hash idempotency).

To remove this marker, delete this file.
`;
}
var _CLAUDE_DESKTOP_BUNDLES_SUBPATH = "claude-desktop/bundles";
var GLOBAL_ROOT = path18.join(os8.homedir(), ".event4u", "agent-config");
var GLOBAL_USER_SETTINGS_PATH = path18.join(GLOBAL_ROOT, ".agent-user.yml");
var GLOBAL_AGENT_SETTINGS_PATH = path18.join(GLOBAL_ROOT, ".agent-settings.yml");
function _bridge_marker(tool_id, scope) {
  if (scope === "global") return USER_SCOPE_PATHS[tool_id] ?? "";
  return PROJECT_BRIDGE_MARKERS[tool_id] ?? "";
}
function _validate_scope(tools, scope, was_all) {
  if (scope !== "project" && scope !== "global") {
    fail(`_validate_scope: unknown scope '${scope}'`);
  }
  if (process3.env["AGENT_CONFIG_DEV_MODE"] === "1") return tools;
  const incompatible = [...tools].filter((t) => {
    const sup = SCOPE_SUPPORT[t] ?? "both";
    return sup !== "both" && sup !== scope;
  }).sort();
  if (incompatible.length === 0) return tools;
  if (was_all) {
    return new Set([...tools].filter((t) => !incompatible.includes(t)));
  }
  const hint = scope === "global" ? "drop --global (project is the default scope)" : "use --global";
  fail(`--tools: ${incompatible.join(", ")} does not support --${scope} scope (${hint})`);
}
function _enforce_consumer_global_only(scope) {
  if (scope !== "project") return;
  if (process3.env["AGENT_CONFIG_DEV_MODE"] === "1") return;
  fail(
    "--scope=project is reserved for maintainers (ADR-020 \u2014 consumer installs are global-only). Set AGENT_CONFIG_DEV_MODE=1 to opt in. See docs/maintainers/dev-mode.md."
  );
}
function _enforce_not_source_repo(scope, project_root) {
  if (scope === "global") return;
  if (process3.env["AGENT_CONFIG_ALLOW_SELF_INSTALL"] === "1") return;
  const [is_source, signature] = _is_agent_config_source_repo(project_root);
  if (!is_source) return;
  fail(
    `Refusing to install agent-config into its own source checkout (detected: ${signature}). The source repo is global-only \u2014 a project-scope install would recreate the .augment/ .claude/ .cursor/ projection trees in the repo (double token cost). Run \`task sync\` to regenerate them from .agent-src.uncondensed/ instead, or set AGENT_CONFIG_ALLOW_SELF_INSTALL=1 to force.`
  );
}
function _load_yaml_doc(p) {
  if (!pathExists(p) || !isFile(p)) return {};
  let text;
  try {
    text = readText(p);
  } catch {
    return {};
  }
  const data = yamlSafeLoad2(text);
  return _isPlainObject2(data) ? data : {};
}
function _load_default_settings(package_root) {
  const template_source = path18.join(package_root, "src", "config", "agent-settings.template.yml");
  if (!pathExists(template_source)) return {};
  let text;
  try {
    text = readText(template_source);
  } catch {
    return {};
  }
  const rendered = text.split(RULE_LOADING_TIER_PLACEHOLDER).join(DEFAULT_PROFILE).split(USER_TYPE_PLACEHOLDER).join("");
  const data = yamlSafeLoad2(rendered);
  return _isPlainObject2(data) ? data : {};
}
var RULE_LAYER_CHOICES = ["global", "project", "both-acknowledged"];
function _suppress_rule_layer(project_root, suppress_dir) {
  const target = path18.join(project_root, ".claude", "settings.local.json");
  const existing = pathExists(target) ? read_json_file(target) : {};
  let real_dir = suppress_dir;
  try {
    real_dir = fs21.realpathSync(suppress_dir);
  } catch {
    real_dir = suppress_dir;
  }
  const entry = claudeMdExcludesGlob(real_dir);
  const merged = mergeClaudeMdExcludes(existing["claudeMdExcludes"], entry);
  if (JSON.stringify(existing["claudeMdExcludes"] ?? null) === JSON.stringify(merged)) return;
  write_json_file(target, { ...existing, claudeMdExcludes: merged });
  success(`.claude/settings.local.json: claudeMdExcludes += ${entry}`);
}
function _gate_rule_layer_overlap(project_root, layer, dry_run) {
  const global_dir = path18.join(os8.homedir(), ".claude", "rules");
  const project_dir = path18.join(project_root, ".claude", "rules");
  const g = readRuleLayer(global_dir);
  const p = readRuleLayer(project_dir);
  if (g === null || p === null) return true;
  const report = compareLayers(g.files, p.files);
  if (report.overlap.length === 0) return true;
  if (layer === null) {
    warn(
      `rule layers overlap: ${report.overlap.length} rule(s) are in BOTH ${global_dir} and ${project_dir}, so Claude Code loads them twice (${report.redundant_chars} chars of standing context per session).`
    );
    info("Pick which layer owns the corpus \u2014 no file is deleted either way:");
    info(`  --layer=global              keep ${global_dir}, suppress the project one`);
    info(`  --layer=project             keep ${project_dir}, suppress the global one`);
    info("  --layer=both-acknowledged   keep both and pay the doubled context knowingly");
    return false;
  }
  const action = decideLayerAction(
    report,
    layer,
    global_dir,
    project_dir
  );
  if (action.refresh_required && action.suppress_dir !== null) {
    warn(
      `${report.divergent.length} shared rule(s) differ in body between the two layers (${report.divergent.slice(0, 5).join(", ")}${report.divergent.length > 5 ? ", \u2026" : ""}). Suppressing a layer now would drop whatever only that copy carries. Re-run the projection first, or pass --layer=both-acknowledged.`
    );
    return false;
  }
  info(action.note);
  if (action.suppress_dir !== null && !dry_run) {
    _suppress_rule_layer(project_root, action.suppress_dir);
  }
  return true;
}
function _resolve_scope(opts, detected, detect_reason, custom_path) {
  if (opts.scope === "project") return "project";
  if (opts.scope === "global") return "global";
  if (opts.scope === "prompt") {
    return _run_scope_prompt(opts, detect_reason || "forced by --scope=prompt", custom_path);
  }
  if (opts.scope === "auto") {
    if (detected === "prompt") return _run_scope_prompt(opts, detect_reason, custom_path);
    if (!state.QUIET) info(`Scope: ${detected} (auto-detected; ${detect_reason})`);
    return detected;
  }
  if (opts.global_install) return "global";
  if (detected === "prompt") return _run_scope_prompt(opts, detect_reason, custom_path);
  if (!state.QUIET) {
    info(
      `Scope detection: ${detected} (${detect_reason}). Using project default for backward compatibility; pass --scope=auto to honor detection.`
    );
  }
  return "project";
}
function _run_scope_prompt(opts, reason, custom_path) {
  if (!process3.stdin.isTTY && custom_path === null) {
    fail(
      "Ambiguous install scope detected and stdin is not a TTY. Pass --scope=project|global (or --custom-path=<dir>) to override."
    );
  }
  const choice = prompt_scope_choice(reason);
  if (choice === "project") return "project";
  if (choice === "global") return "global";
  let cp = custom_path;
  if (cp === null) {
    let raw;
    raw = _read_line("Custom destination path: ");
    if (raw === null) {
      fail("Custom-path prompt aborted (EOF on stdin)");
    }
    if (!raw) fail("Custom-path prompt requires a non-empty path");
    cp = resolvePath(expanduser6(raw));
    opts.custom_path = cp;
  }
  if (!state.QUIET) info(`Custom destination: ${cp}`);
  return "project";
}
var SCOPE_DETECT_MANIFESTS = [
  "package.json",
  "composer.json",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "Gemfile"
];
var SCOPE_DETECT_AI_DIRS = [
  ".claude",
  ".cursor",
  ".windsurf",
  ".augment",
  ".clinerules",
  ".copilot",
  ".gemini",
  ".codex",
  ".aider",
  ".continue",
  ".roo",
  ".kilocode"
];
var SCOPE_DETECT_AI_FILES = [
  "CLAUDE.md",
  "AGENTS.md",
  "GEMINI.md",
  ".windsurfrules",
  ".aider.conf.yml"
];
function detect_scope(cwd) {
  if (pathExists(_resolve_settings_read(cwd))) {
    return ["project", `existing ${SETTINGS_FILE}`];
  }
  const has_manifest = SCOPE_DETECT_MANIFESTS.find((m) => pathExists(path18.join(cwd, m))) ?? null;
  const has_ai_dir = SCOPE_DETECT_AI_DIRS.find((d) => isDir(path18.join(cwd, d))) ?? null;
  const has_ai_file = SCOPE_DETECT_AI_FILES.find((f) => pathExists(path18.join(cwd, f))) ?? null;
  if (has_manifest && (has_ai_dir || has_ai_file)) {
    const marker = has_ai_dir || has_ai_file;
    return ["prompt", `manifest (${has_manifest}) + AI-tool config (${marker})`];
  }
  return ["global", "no project-scope signals"];
}
var SCOPE_CUSTOM = "custom";
function _read_line(prompt_text) {
  const line = readLineSyncRaw(prompt_text);
  if (line === null) return null;
  return line.trim();
}
function readLineSyncRaw(promptText) {
  process3.stdout.write(promptText);
  const buf = Buffer.alloc(1);
  const bytes = [];
  let sawAny = false;
  for (; ; ) {
    let n;
    try {
      n = fs21.readSync(0, buf, 0, 1, null);
    } catch (err) {
      const code = err.code;
      if (code === "EAGAIN") {
        continue;
      }
      if (code === "EOF") {
        break;
      }
      throw err;
    }
    if (n === 0) break;
    sawAny = true;
    const ch = buf[0];
    if (ch === 10) {
      if (bytes.length > 0 && bytes[bytes.length - 1] === 13) bytes.pop();
      return Buffer.from(bytes).toString("utf-8");
    }
    bytes.push(ch);
  }
  if (!sawAny && bytes.length === 0) return null;
  return Buffer.from(bytes).toString("utf-8");
}
function prompt_scope_choice(reason) {
  process3.stdout.write("\n");
  info(`Ambiguous install scope: ${reason}.`);
  info("Choose where to install:");
  process3.stdout.write("  1) Project \u2014 install into the current directory\n");
  process3.stdout.write("  2) User    \u2014 install into ~/ (recommended; one install per machine)\n");
  process3.stdout.write("  3) Custom  \u2014 specify an explicit destination path\n");
  process3.stdout.write("\n");
  let attempts = 0;
  while (attempts < 3) {
    const reply = _read_line("Choose [1/2/3]: ");
    if (reply === null) {
      fail("Scope prompt aborted (EOF on stdin); pass --scope=project|global to override");
    }
    if (["1", "project", "p"].includes(reply)) return "project";
    if (["2", "global", "user", "u", "g"].includes(reply)) return "global";
    if (["3", "custom", "c"].includes(reply)) return SCOPE_CUSTOM;
    attempts += 1;
    warn(`Invalid choice '${reply}'. Enter 1, 2, or 3.`);
  }
  fail("Scope prompt aborted (3 invalid replies); pass --scope=project|global to override");
}
function _sha256_of_file(p) {
  return sha256OfFile(p);
}
function _file_entry(p, kind, hash_content) {
  return {
    path: p,
    kind,
    sha256: hash_content ? _sha256_of_file(p) : null
  };
}
function _files_by_tool_from_deploy(deploy_results) {
  const out = {};
  for (const tool_id of Object.keys(deploy_results)) {
    const [, , status, paths] = deploy_results[tool_id];
    if (status === "deployed") {
      out[tool_id] = paths.map((p) => _file_entry(p, "deployed", true));
    } else if (status === "marker") {
      out[tool_id] = paths.map((p) => _file_entry(p, "marker", true));
    } else {
      out[tool_id] = [];
    }
  }
  return out;
}
function _files_by_tool_from_bridges(tools, project_root, scope) {
  const out = {};
  for (const tool_id of [...tools].sort()) {
    const marker = _bridge_marker(tool_id, scope);
    if (!marker) continue;
    let marker_path = marker;
    if (!path18.isAbsolute(marker_path)) {
      marker_path = path18.join(project_root, marker_path);
    }
    out[tool_id] = [_file_entry(marker_path, "bridge", false)];
  }
  return out;
}
function _update_installed_tools_manifest(project_root, tools, scope, force, files_by_tool = null, merged_keys_by_tool = null) {
  const target = manifest_path(project_root);
  const existing = read_manifest(target) ?? {};
  let entries = Array.isArray(existing["tools"]) ? [...existing["tools"]] : [];
  const version = current_package_version();
  for (const tool_id of [...tools].sort()) {
    const marker = _bridge_marker(tool_id, scope);
    if (!marker) continue;
    const files = files_by_tool ? files_by_tool[tool_id] ?? null : null;
    const merged_keys = merged_keys_by_tool ? merged_keys_by_tool[tool_id] ?? null : null;
    try {
      entries = upsert_tool(entries, {
        name: tool_id,
        scope,
        bridge_marker: marker,
        force,
        files,
        merged_keys
      });
    } catch (exc) {
      if (exc instanceof ScopeMismatchError) {
        if (!state.QUIET) {
          warn(String(exc.message));
          info(`  Manifest: ${target}`);
          info("  Override: re-run with `--force` to rewrite the entry");
        }
        return 1;
      }
      throw exc;
    }
  }
  write_manifest(target, version, entries);
  if (!state.QUIET) {
    const rel = isRelativeTo(target, project_root) ? path18.relative(project_root, target) : target;
    info(`Manifest updated: ${rel}`);
  }
  return 0;
}
function isRelativeTo(child, parent) {
  const rel = path18.relative(parent, child);
  return rel === "" || !rel.startsWith("..") && !path18.isAbsolute(rel);
}
function _resolve_package_root_for_global() {
  const here = resolvePath(_HERE2);
  const candidate = path18.dirname(path18.dirname(path18.dirname(here)));
  if (!pathExists(path18.join(candidate, "src", "config", "profiles", "minimal.ini"))) {
    fail(
      `Could not locate agent-config package root from ${here}. Expected src/config/profiles/minimal.ini at the parent directory.`
    );
  }
  return candidate;
}
var CONSUMER_BRIDGE_MARKER_RELPATH = path18.join("agents", ".event4u-bridge.yml");
var MIGRATE_LEGACY_YAML_FILES = [".agent-settings.yml", ".agent-user.yml"];
var MIGRATE_LEGACY_TOOL_DIRS = [".augment", ".claude", ".cursor"];
var AGENT_CONFIG_PACKAGE_NAME = "@event4u/agent-config";
function _is_agent_config_source_repo(project_root) {
  if (process3.env["AGENT_CONFIG_CONSUMER_MODE"] === "1") {
    return [false, "consumer-mode-override"];
  }
  const pkg_json = path18.join(project_root, "package.json");
  if (isFile(pkg_json)) {
    let data = {};
    try {
      data = JSON.parse(readText(pkg_json));
    } catch {
      data = {};
    }
    if (_isPlainObject2(data) && data["name"] === AGENT_CONFIG_PACKAGE_NAME) {
      return [true, "package.json:name"];
    }
  }
  if (isDir(path18.join(project_root, ".agent-src.uncondensed"))) {
    return [true, ".agent-src.uncondensed/"];
  }
  const packages_dir = path18.join(project_root, "packages");
  if (isDir(packages_dir)) {
    for (const child of fs21.readdirSync(packages_dir)) {
      if (isDir(path18.join(packages_dir, child, ".agent-src.uncondensed"))) {
        return [true, `packages/${child}/.agent-src.uncondensed/`];
      }
    }
  }
  const installer_self = path18.join(project_root, "scripts", "install.py");
  try {
    if (isFile(installer_self) && resolvePath(installer_self) === resolvePath(_HERE2)) {
      return [true, "src/scripts/install.py (self)"];
    }
  } catch {
  }
  return [false, ""];
}
function _detect_legacy_for_migration(project_root) {
  if (process3.env["AGENT_CONFIG_DEV_MODE"] === "1") return [];
  const [is_source, signature] = _is_agent_config_source_repo(project_root);
  if (is_source) {
    if (!state.QUIET) {
      warn(
        `Maintainer mode auto-detected \u2014 agent-config source repo (signature: ${signature}). Skipping ADR-020 migration prompt; the working tree stays intact. Set AGENT_CONFIG_CONSUMER_MODE=1 to override for end-to-end consumer-flow testing.`
      );
    }
    return [];
  }
  if (isFile(path18.join(project_root, INSTALL_MODE_MARKER_REL))) return [];
  const found = [];
  for (const name of MIGRATE_LEGACY_YAML_FILES) {
    if (isFile(path18.join(project_root, name))) {
      found.push(name);
    } else if (isFile(path18.join(project_root, "settings", name))) {
      found.push(`settings/${name}`);
    }
  }
  for (const name of MIGRATE_LEGACY_TOOL_DIRS) {
    const p = path18.join(project_root, name);
    if (isDir(p) && !isSymlink(p)) {
      found.push(`${name}/`);
    }
  }
  return found.sort();
}
function _prompt_migrate_to_global(project_root, artefacts) {
  if (!state.QUIET) {
    process3.stdout.write("\n");
    warn("Legacy project-local artefacts detected \u2014 pre-ADR-020 layout:");
    for (const rel of artefacts) {
      info(`  ${path18.join(project_root, rel)}`);
    }
    info("The unified `agent-config migrate` sweeps these in one pass.");
    info("The wizard recreates fresh config afterwards.");
  }
  if (!_is_interactive()) {
    if (!state.QUIET) info("Non-interactive mode \u2192 defaulting to YES (run migration).");
    return true;
  }
  let attempts = 0;
  while (attempts < 3) {
    const reply = _read_line("Run `agent-config migrate` now? [Y/n]: ");
    if (reply === null) return false;
    if (reply === "" || ["y", "yes"].includes(reply.toLowerCase())) return true;
    if (["n", "no"].includes(reply.toLowerCase())) return false;
    attempts += 1;
    warn(`Invalid choice '${reply}'. Enter Y or n.`);
  }
  return false;
}
function _run_migrate_to_global(project_root) {
  try {
    return main([], { cwd: project_root });
  } catch (exc) {
    warn(`migrate unavailable: ${String(exc)}`);
    return 1;
  }
}
function _format_global_root_for_marker(global_root) {
  const home = resolvePath(os8.homedir());
  const resolved = resolvePath(global_root);
  const rel = path18.relative(home, resolved);
  if (rel === "" || rel.startsWith("..") || path18.isAbsolute(rel)) {
    return global_root;
  }
  return `~/${rel.split(path18.sep).join("/")}`;
}
function _remove_legacy_consumer_bridge_marker(project_root, env = null) {
  const env_map = env ?? process3.env;
  if (env_map["AGENT_CONFIG_DEV_MODE"] === "1") return null;
  if (isDir(path18.join(project_root, ".agent-src.uncondensed"))) return null;
  const target = path18.join(project_root, CONSUMER_BRIDGE_MARKER_RELPATH);
  if (!isFile(target)) return null;
  try {
    fs21.rmSync(target);
  } catch {
    return null;
  }
  return target;
}
var PROJECT_ANCHOR_TOOLS = {
  windsurf: ".windsurf/agent-config.bridge.yml",
  cline: ".clinerules/agent-config.bridge.yml",
  "gemini-cli": ".gemini/agent-config.bridge.yml"
};
function _write_per_tool_project_anchors(project_root, tools, env = null, now = null) {
  const env_map = env ?? process3.env;
  if (env_map["AGENT_CONFIG_DEV_MODE"] === "1") return [];
  if (isDir(path18.join(project_root, ".agent-src.uncondensed"))) return [];
  const global_root_str = _format_global_root_for_marker(
    event4u_root(env_map)
  );
  const stamp = utcStamp(now ?? void 0);
  const written = [];
  for (const tool_id of Object.keys(PROJECT_ANCHOR_TOOLS).sort()) {
    const rel_path = PROJECT_ANCHOR_TOOLS[tool_id];
    if (!tools.has(tool_id)) continue;
    const target = path18.join(project_root, rel_path);
    mkdirp(path18.dirname(target));
    const body = `# event4u/agent-config \u2014 per-tool project anchor (auto-written).
# Spec: docs/contracts/consumer-bridge.md \xA7 Per-tool anchor strategy.
# Tool: ${tool_id}. Resolves the global install directly \u2014 no
# project-local bridge marker (retired, ADR-020 amendment 2026-07-13).
# This anchor is gitignored: each developer regenerates it on install.
schema: event4u-bridge/v1
tool: ${tool_id}
global_root: ${global_root_str}
installed_at: ${stamp}
`;
    atomicWrite0644(target, body, ".agent-config.bridge.");
    written.push(target);
  }
  return written;
}
var PACKAGE_TAG_ID = "event4u/agent-config";
function _inject_package_tag(target, source, package_root) {
  if (path18.extname(target) !== ".md") return;
  let text;
  try {
    text = readText(target);
  } catch {
    return;
  }
  if (!text.startsWith("---\n") && !text.startsWith("---\r\n")) return;
  const lines = splitlinesKeepends(text);
  let close_idx = null;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].replace(/[\r\n]+$/, "") === "---") {
      close_idx = i;
      break;
    }
  }
  if (close_idx === null) return;
  let fm_lines = lines.slice(1, close_idx);
  const body_lines = lines.slice(close_idx);
  let source_value = null;
  if (source !== null) {
    let resolved_src;
    try {
      resolved_src = resolvePath(source);
    } catch {
      resolved_src = source;
    }
    if (package_root !== null) {
      const rel = path18.relative(resolvePath(package_root), resolved_src);
      if (rel !== "" && !rel.startsWith("..") && !path18.isAbsolute(rel)) {
        source_value = rel;
      } else {
        source_value = resolved_src;
      }
    } else {
      source_value = resolved_src;
    }
  }
  const _set_key = (block, key, value) => {
    const prefix = `${key}:`;
    const rendered = `${key}: ${value}
`;
    for (let idx = 0; idx < block.length; idx += 1) {
      if (block[idx].startsWith(prefix)) {
        block[idx] = rendered;
        return block;
      }
    }
    block.push(rendered);
    return block;
  };
  fm_lines = _set_key(fm_lines, "package", PACKAGE_TAG_ID);
  if (source_value !== null) {
    fm_lines = _set_key(fm_lines, "source_path", source_value);
  }
  const new_text = [lines[0], ...fm_lines, ...body_lines].join("");
  if (new_text !== text) {
    writeText(target, new_text);
  }
}
function _escapes_package_root(resolved, package_root) {
  if (package_root === null) return false;
  let root;
  try {
    root = fs21.realpathSync(package_root);
  } catch {
    return false;
  }
  return !is_ancestor(root, resolved);
}
function _copy_dir_dereferencing_symlinks(src, dest, force, package_root = null, file_filter = null) {
  let written = 0;
  let skipped = 0;
  const written_paths = [];
  if (!pathExists(src)) return [0, 0, written_paths];
  if (!isDir(src)) {
    if (file_filter !== null && !file_filter(src)) return [0, 0, written_paths];
    let resolved_src = src;
    try {
      resolved_src = fs21.realpathSync(src);
    } catch {
      resolved_src = src;
    }
    if (_escapes_package_root(resolved_src, package_root)) {
      warn(`refused: ${src} dereferences outside the package root \u2014 not copied`);
      return [0, 0, written_paths];
    }
    mkdirp(path18.dirname(dest));
    const decision = _resolve_file_conflict(dest, force);
    if (decision === "skip") return [0, 1, written_paths];
    fs21.copyFileSync(src, dest);
    _inject_package_tag(dest, src, package_root);
    written_paths.push(dest);
    return [1, 0, written_paths];
  }
  mkdirp(dest);
  const walk = (node) => {
    const acc = [];
    const names = fs21.readdirSync(node).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
    for (const name of names) {
      const entry = path18.join(node, name);
      acc.push(entry);
      const lst = fs21.lstatSync(entry);
      if (lst.isDirectory() && !lst.isSymbolicLink()) {
        acc.push(...walk(entry));
      }
    }
    return acc;
  };
  for (const entry of walk(src)) {
    const rel = path18.relative(src, entry);
    const target = path18.join(dest, rel);
    const lst = fs21.lstatSync(entry);
    if (lst.isDirectory() && !lst.isSymbolicLink()) {
      mkdirp(target);
      continue;
    }
    let resolvedIsDir = false;
    let resolved = entry;
    try {
      resolved = fs21.realpathSync(entry);
      resolvedIsDir = fs21.statSync(entry).isDirectory();
    } catch {
      resolvedIsDir = false;
    }
    if (_escapes_package_root(resolved, package_root)) {
      warn(`refused: ${entry} dereferences outside the package root \u2014 not copied`);
      continue;
    }
    if (resolvedIsDir) {
      mkdirp(target);
      const [sub_w, sub_s, sub_p] = _copy_dir_dereferencing_symlinks(
        resolved,
        target,
        force,
        package_root,
        file_filter
      );
      written += sub_w;
      skipped += sub_s;
      written_paths.push(...sub_p);
      continue;
    }
    if (file_filter !== null && !file_filter(entry)) {
      continue;
    }
    const decision = _resolve_file_conflict(target, force);
    if (decision === "skip") {
      skipped += 1;
      continue;
    }
    mkdirp(path18.dirname(target));
    fs21.copyFileSync(resolved, target);
    _inject_package_tag(target, resolved, package_root);
    written += 1;
    written_paths.push(target);
  }
  return [written, skipped, written_paths];
}
function _claude_desktop_bundles_dir() {
  return write_target(_CLAUDE_DESKTOP_BUNDLES_SUBPATH);
}
function _write_claude_desktop_marker(_force, lockfile_path2, bundles_dir, bundle_count) {
  const anchor = expanduser6(USER_SCOPE_PATHS["claude-desktop"]);
  const target = path18.join(anchor, "agent-config.md");
  mkdirp(anchor);
  const body = claudeDesktopMarkerBody(lockfile_path2, anchor, bundles_dir, bundle_count);
  writeText(target, body);
  return [1, 0, [target]];
}
function _deploy_claude_desktop(force, package_root, lockfile_path2) {
  const bundles_dir = _claude_desktop_bundles_dir();
  build_skill_bundles(package_root, bundles_dir, force);
  build_command_bundles(package_root, bundles_dir, force);
  const bundle_count = countZips(bundles_dir);
  const [, , marker_paths] = _write_claude_desktop_marker(
    force,
    lockfile_path2,
    bundles_dir,
    bundle_count
  );
  return [bundle_count, 0, "deployed", [bundles_dir, ...marker_paths]];
}
var _CLAUDE_FLAT_WRAPPER_EXTRA = /* @__PURE__ */ new Set(["commit"]);
function _apply_claude_flat_command_wrappers(anchor, package_root, current_files) {
  const wrapped = [];
  const collisions = [];
  const reserved = [];
  const commands_dir = path18.join(anchor, "commands");
  let flat_entries = [];
  try {
    flat_entries = fs21.readdirSync(commands_dir).filter((f) => f.endsWith(".md"));
  } catch {
  }
  for (const fname of flat_entries.sort()) {
    const slug = fname.slice(0, -".md".length);
    if (!is_claude_builtin_name(slug)) continue;
    fs21.rmSync(path18.join(commands_dir, fname), { force: true });
    current_files.delete(`commands/${fname}`);
    reserved.push(slug);
  }
  const eligible = new Set(_CLAUDE_FLAT_WRAPPER_EXTRA);
  try {
    const manifest = JSON.parse(
      fs21.readFileSync(path18.join(package_root, "dist", "discovery", "discovery-manifest.json"), "utf8")
    );
    for (const a of manifest.artefacts ?? []) {
      if (a.category !== "command" || typeof a.slug !== "string") continue;
      const visible = typeof a.visibility === "string" ? a.visibility !== "internal" : typeof a.tier === "number" ? a.tier <= 1 : false;
      if (visible) eligible.add(a.slug);
    }
  } catch {
  }
  for (const slug of [...eligible].sort()) {
    const flat_rel = `commands/${slug}.md`;
    const flat_abs = path18.join(anchor, "commands", `${slug}.md`);
    if (!fs21.existsSync(flat_abs)) continue;
    const skill_dir = path18.join(anchor, "skills", slug);
    if (fs21.existsSync(skill_dir)) {
      collisions.push(slug);
      continue;
    }
    let body = fs21.readFileSync(flat_abs, "utf8");
    if (body.startsWith("---\n") && !/^name:/m.test(body.split("\n---")[0] ?? "")) {
      body = body.replace("---\n", `---
name: ${slug}
`);
    }
    fs21.mkdirSync(skill_dir, { recursive: true });
    fs21.writeFileSync(path18.join(skill_dir, "SKILL.md"), body, "utf8");
    fs21.rmSync(flat_abs, { force: true });
    current_files.delete(flat_rel);
    current_files.add(`skills/${slug}/SKILL.md`);
    wrapped.push(slug);
  }
  return { wrapped, collisions, reserved };
}
function _deploy_global_content(tools, force, package_root, lockfile_path2) {
  const results = {};
  const rule_scope = _resolve_global_rule_scope(package_root);
  for (const tool_id of [...tools].sort()) {
    if (tool_id === "claude-desktop") {
      results[tool_id] = _deploy_claude_desktop(force, package_root, lockfile_path2);
      continue;
    }
    const plan = GLOBAL_DEPLOY_SOURCES[tool_id];
    if (plan === void 0) {
      const status = ["copilot", "aider", "zed", "jetbrains"].includes(tool_id) ? "hint" : "unsupported";
      results[tool_id] = [0, 0, status, []];
      continue;
    }
    const anchor_raw = USER_SCOPE_PATHS[tool_id];
    if (!anchor_raw) {
      results[tool_id] = [0, 0, "unsupported", []];
      continue;
    }
    const anchor = expanduser6(anchor_raw);
    let written_total = 0;
    let skipped_total = 0;
    const written_paths = [];
    let current_files = /* @__PURE__ */ new Set();
    for (const [src_rel, dest_sub] of plan) {
      const src = path18.join(package_root, src_rel);
      const dest = dest_sub ? path18.join(anchor, dest_sub) : anchor;
      const rule_filter = _rule_filter_for_source(src_rel, rule_scope);
      const [w, s, paths] = _copy_dir_dereferencing_symlinks(
        src,
        dest,
        force,
        package_root,
        rule_filter
      );
      written_total += w;
      skipped_total += s;
      written_paths.push(...paths);
      current_files = setUnion(
        current_files,
        expected_deploy_files(
          src,
          dest_sub ? dest_sub : "",
          rule_filter
        )
      );
    }
    if (tool_id === "claude-code") {
      const res = _apply_claude_flat_command_wrappers(anchor, package_root, current_files);
      if (res.wrapped.length > 0 && !state.QUIET) {
        info(
          `  claude-code: ${res.wrapped.length} visible flat command(s) projected as skill wrappers (Claude Code flat-command discovery workaround)`
        );
      }
      if (res.reserved.length > 0 && !state.QUIET) {
        info(
          `  claude-code: ${res.reserved.length} flat command(s) withheld \u2014 name is a Claude Code built-in (${res.reserved.join(", ")}); nested /cluster:sub commands remain available`
        );
      }
    }
    const missing_targets = _verify_deploy_targets(anchor, plan);
    if (missing_targets.length > 0) {
      if (!state.QUIET) {
        warn(
          `${tool_id}: deploy postcheck failed \u2014 missing/empty: ${missing_targets.join(", ")}`
        );
      }
      _emit_progress({ type: "verify_failed", tool: tool_id, missing: missing_targets });
      results[tool_id] = [written_total, skipped_total, "deploy_failed", written_paths];
      continue;
    }
    _emit_progress({ type: "verified", tool: tool_id });
    const inventory = load_inventory();
    let reaped = [];
    const inv_tools = inventory["tools"] ?? {};
    if (tool_id in inv_tools) {
      reaped = reaped.concat(
        reap_stale(tool_id, anchor, current_files, inventory)
      );
    }
    reaped = reaped.concat(
      reap_tagged_orphans(
        anchor,
        plan.map(([, dest_sub]) => dest_sub),
        current_files,
        PACKAGE_TAG_ID
      )
    );
    reaped = [...new Set(reaped)].sort();
    record_deploy(tool_id, anchor_raw, current_files, inventory);
    save_inventory(inventory);
    if (reaped.length > 0 && !state.QUIET) {
      info(
        `  ${tool_id}: reaped ${reaped.length} stale deployed file(s) from a previous install`
      );
    }
    _emit_progress({ type: "reaped", tool: tool_id, count: reaped.length });
    results[tool_id] = [written_total, skipped_total, "deployed", written_paths];
    if (tool_id === "claude-code") {
      try {
        const manifest = path18.join(package_root, "src", "scripts", "hook_manifest.yaml");
        const matrix = build_claude_hook_matrix(manifest);
        const res = ensure_managed_hooks(
          path18.join(anchor, "settings.json"),
          matrix
        );
        if (!state.QUIET) {
          if (res.changed) {
            success(
              `claude-code: managed hooks registered in ~/.claude/settings.json (${res.events.length} event(s))`
            );
          } else {
            skip("claude-code: managed hooks already registered");
          }
        }
      } catch (e) {
        warn(`claude-code: managed-hook registration failed \u2014 ${String(e)}`);
        _emit_progress({ type: "hooks_failed", tool: tool_id, error: String(e) });
      }
    }
  }
  return results;
}
function setUnion(a, b) {
  const out = new Set(a);
  for (const v of b) out.add(v);
  return out;
}
function _preview_global_reap(tools, package_root) {
  const inventory = load_inventory();
  const preview = {};
  const rule_scope = _resolve_global_rule_scope(package_root);
  for (const tool_id of [...tools].sort()) {
    const plan = GLOBAL_DEPLOY_SOURCES[tool_id];
    if (plan === void 0) continue;
    const anchor_raw = USER_SCOPE_PATHS[tool_id];
    if (!anchor_raw) continue;
    const anchor = expanduser6(anchor_raw);
    let current_files = /* @__PURE__ */ new Set();
    for (const [src_rel, dest_sub] of plan) {
      const src = path18.join(package_root, src_rel);
      current_files = setUnion(
        current_files,
        expected_deploy_files(
          src,
          dest_sub ? dest_sub : "",
          _rule_filter_for_source(src_rel, rule_scope)
        )
      );
    }
    let would_reap = [];
    const inv_tools = inventory["tools"] ?? {};
    if (tool_id in inv_tools) {
      would_reap = would_reap.concat(
        reap_stale(tool_id, anchor, current_files, inventory, true)
      );
    }
    would_reap = would_reap.concat(
      reap_tagged_orphans(
        anchor,
        plan.map(([, dest_sub]) => dest_sub),
        current_files,
        PACKAGE_TAG_ID,
        true
      )
    );
    const paths = [...new Set(would_reap.map((p) => String(p)))].sort();
    if (paths.length > 0) preview[tool_id] = paths;
  }
  return preview;
}
function _verify_deploy_targets(anchor, plan) {
  const missing = [];
  for (const [, dest_sub] of plan) {
    const target = dest_sub ? path18.join(anchor, dest_sub) : anchor;
    const label = dest_sub || ".";
    if (!isDir(target)) {
      missing.push(label);
      continue;
    }
    try {
      const entries = fs21.readdirSync(target);
      if (entries.length === 0) missing.push(label);
    } catch {
      missing.push(label);
    }
  }
  return missing;
}
function _prune_modules_by(deploy_results, is_pruned) {
  let pruned = 0;
  const adjusted = {};
  for (const tool_id of Object.keys(deploy_results)) {
    const [written, skipped, status, paths] = deploy_results[tool_id];
    const pruned_skill_dirs = /* @__PURE__ */ new Set();
    for (const p of paths) {
      const parts = p.split(path18.sep);
      if (parts.includes("skills")) {
        const i = parts.indexOf("skills");
        if (i + 1 < parts.length) {
          const skill_root = parts.slice(0, i + 2).join(path18.sep);
          if (!pruned_skill_dirs.has(skill_root)) {
            const skillmd = path18.join(skill_root, "SKILL.md");
            if (pathExists(skillmd) && is_pruned(skillmd)) {
              pruned_skill_dirs.add(skill_root);
            }
          }
        }
      }
    }
    const keep = [];
    const delete_files = [];
    for (const p of paths) {
      const parts = p.split(path18.sep);
      let is_target = false;
      if (parts.includes("skills")) {
        const i = parts.indexOf("skills");
        if (i + 1 < parts.length && pruned_skill_dirs.has(parts.slice(0, i + 2).join(path18.sep))) {
          is_target = true;
        }
      } else if (parts.includes("commands") && path18.extname(p) === ".md" && is_pruned(p)) {
        is_target = true;
      }
      (is_target ? delete_files : keep).push(p);
    }
    for (const d of pruned_skill_dirs) {
      fs21.rmSync(d, { recursive: true, force: true });
    }
    for (const p of delete_files) {
      if (p.split(path18.sep).includes("commands") && pathExists(p)) {
        try {
          fs21.unlinkSync(p);
        } catch {
        }
      }
    }
    pruned += delete_files.length;
    adjusted[tool_id] = [Math.max(0, written - delete_files.length), skipped, status, keep];
  }
  return [pruned, adjusted];
}
function _prune_lab_modules(deploy_results, lab_ids) {
  return _prune_modules_by(deploy_results, (p) => is_lab_artefact(p, lab_ids));
}
var _load_packs_registry = load_packs_registry;
var _compute_active_pack_ids = compute_active_pack_ids;
function _resolve_global_settings_doc() {
  const p = _resolve_global_settings_path();
  return p === null ? null : _load_yaml_doc(p);
}
function _resolve_global_settings_path() {
  const root = event4u_root();
  const canonical = path18.join(root, "settings", SETTINGS_FILE);
  if (pathExists(canonical)) return canonical;
  const legacy = path18.join(root, SETTINGS_FILE);
  if (pathExists(legacy)) return legacy;
  return null;
}
function _resolve_scoped_projection(package_root) {
  const doc = _resolve_global_settings_doc() ?? _load_default_settings(package_root);
  const projection = _isPlainObject2(doc["projection"]) ? doc["projection"] : {};
  const mode = projection["mode"] === "scoped" ? "scoped" : "legacy-all";
  const runtime = _isPlainObject2(doc["runtime"]) ? doc["runtime"] : {};
  const active_packs_raw = runtime["active_packs"];
  const active_packs = Array.isArray(active_packs_raw) ? active_packs_raw.filter((v) => typeof v === "string") : [];
  return { mode, active_packs };
}
function _resolve_global_rule_scope(package_root) {
  const settings_path = _resolve_global_settings_path();
  if (settings_path === null) {
    try {
      return ruleScopeFromSettings(_load_default_settings(package_root), package_root);
    } catch {
      return LEGACY_ALL;
    }
  }
  let text;
  try {
    text = readText(settings_path);
  } catch (e) {
    warn(
      `could not read ${settings_path} (${String(e)}) \u2014 rule scoping falls back to legacy-all, so ALL rules including maintainer-only ones will be installed. Fix the file to restore scoping.`
    );
    return LEGACY_ALL;
  }
  const parsed = yamlSafeLoad2(text);
  if (!_isPlainObject2(parsed)) {
    warn(
      `${settings_path} is not a YAML mapping \u2014 rule scoping falls back to legacy-all, so ALL rules including maintainer-only ones will be installed. Fix the file to restore scoping.`
    );
    return LEGACY_ALL;
  }
  try {
    return ruleScopeFromSettings(parsed, package_root);
  } catch (e) {
    warn(
      `could not derive rule scope from ${settings_path} (${String(e)}) \u2014 falling back to legacy-all; ALL rules will be installed.`
    );
    return LEGACY_ALL;
  }
}
function _rule_filter_for_source(src_rel, scope) {
  if (src_rel !== RULE_SOURCE_REL) return null;
  return (srcFile) => ruleFileArrives(srcFile, scope) && !isExclusivelyPackageOnly(srcFile);
}
function _prune_scoped_modules(deploy_results, active_ids) {
  return _prune_modules_by(
    deploy_results,
    (p) => is_pruned_under_scoped(p, active_ids)
  );
}
function install_global(tools, force, project_root = null, core_only = false) {
  const migrated = migrate_legacy_namespace();
  if (migrated && !state.QUIET) {
    info(
      `\u{1F501} Migrated user-global config to ${event4u_root()} (legacy ${legacy_xdg_root()} preserved as fallback)`
    );
  }
  const installed_version = current_package_version();
  const read_path = lockfile_path();
  const write_path = lockfile_write_path();
  const [, recorded] = check_version(installed_version, { path: read_path });
  const classification = classify_mismatch(installed_version, recorded);
  if (classification === "downgrade" && !force) {
    if (!state.QUIET) {
      process3.stdout.write("\n");
      warn("Refusing global install: lockfile records a newer version.");
      info(`  Lockfile:           ${read_path}`);
      info(`  Recorded version:   ${recorded}`);
      info(`  Current package:    ${installed_version}`);
      info("  Fix:                upgrade the package, or re-run with `--force`");
      process3.stdout.write("\n");
    }
    return 1;
  }
  if (["upgrade", "unparseable"].includes(classification) && !state.QUIET) {
    info(`\u{1F504} Upgrading lockfile from ${recorded} to ${installed_version}, redeploying tools`);
  }
  const migration = migrate_layout({ path: write_path });
  if (migration && migration.changed.length > 0 && !state.QUIET) {
    info(
      `\u{1F527} Migrated install layout v${migration.from} \u2192 v${migration.to}: ` + migration.changed.join("; ")
    );
  }
  if (!state.QUIET) {
    process3.stdout.write("\n");
    info("Agent Config \u2014 Global (user-scope) install [ADR-007]");
    info("Per-tool anchor paths:");
    for (const tool_id of [...tools].sort()) {
      const anchor = USER_SCOPE_PATHS[tool_id];
      if (anchor === void 0) continue;
      process3.stdout.write(`      ${tool_id.padEnd(15)} \u2192 ${anchor}
`);
    }
  }
  const existing = read_lockfile(read_path) ?? {};
  const existing_tools = Array.isArray(existing["tools"]) ? existing["tools"] : [];
  const merged_tools = [.../* @__PURE__ */ new Set([...existing_tools, ...tools])].sort();
  const written = write_lockfile(installed_version, merged_tools, { path: write_path });
  if (!state.QUIET) {
    process3.stdout.write("\n");
    info(`Lockfile written: ${written}`);
    info(`  schema_version=1, agent_config_version=${installed_version}`);
    info(`  tools=${merged_tools.join(",")}`);
  }
  if (project_root !== null && pathExists(_resolve_settings_read(project_root)) && !isDir(path18.join(project_root, ".agent-src.uncondensed"))) {
    const drift = collect_drift(project_root);
    if (!state.QUIET) {
      process3.stdout.write("\n");
      for (const line of format_drift_report(drift).replace(/\n$/, "").split("\n")) {
        info(line);
      }
    }
  }
  const package_root = _resolve_package_root_for_global();
  let deploy_results = _deploy_global_content(tools, force, package_root, written);
  if (core_only) {
    const lab_ids = load_lab_pack_ids(package_root);
    let pruned;
    [pruned, deploy_results] = _prune_lab_modules(deploy_results, lab_ids);
    if (!state.QUIET) {
      info(
        `\u{1F9F9} Core-only install: pruned ${pruned} lab-tier artefact(s) (packs: ${[...lab_ids].sort().join(", ")}).`
      );
    }
  }
  try {
    const { mode, active_packs } = _resolve_scoped_projection(package_root);
    if (mode === "scoped") {
      const packs_registry = _load_packs_registry(package_root);
      const active_ids = _compute_active_pack_ids(packs_registry, active_packs);
      let scoped_pruned;
      [scoped_pruned, deploy_results] = _prune_scoped_modules(deploy_results, active_ids);
      if (!state.QUIET) {
        info(
          `\u{1F9F9} Scoped install: pruned ${scoped_pruned} non-active-pack artefact(s) (active packs: ${[...active_ids].sort().join(", ") || "(none)"}). Set projection.mode: legacy-all in .agent-settings.yml to restore the full surface.`
        );
      }
    }
  } catch (e) {
    if (!state.QUIET) {
      warn(`Scoped-projection prune failed \u2014 restoring full tree (${String(e)}).`);
    }
  }
  const failed_tools = new Set(
    Object.keys(deploy_results).filter(
      (tool_id) => deploy_results[tool_id][2] === "deploy_failed"
    )
  );
  const corrected_tools = failed_tools.size > 0 ? merged_tools.filter((t) => !failed_tools.has(t)) : merged_tools;
  if (failed_tools.size > 0 && !arrayStrEqual(corrected_tools, merged_tools)) {
    write_lockfile(installed_version, corrected_tools, { path: write_path });
    if (!state.QUIET) {
      warn(
        `Lockfile corrected after deploy postcheck \u2014 dropped ${[...failed_tools].sort().join(", ")} (verification failed).`
      );
    }
  }
  stampHostLayerFingerprint(
    installed_version,
    corrected_tools,
    write_path,
    failed_tools.has("claude-code"),
    (m) => {
      if (!state.QUIET) info(m);
    }
  );
  if (state.PROGRESS_NDJSON) {
    const ordered = Object.keys(deploy_results).sort();
    const total = ordered.length;
    ordered.forEach((tool_id, i) => {
      const [, , status] = deploy_results[tool_id];
      _emit_progress({
        type: "file",
        file: tool_id,
        status,
        written: i + 1,
        total
      });
    });
  }
  if (!state.QUIET) {
    process3.stdout.write("\n");
    info("Deployed per-tool content:");
    for (const tool_id of Object.keys(deploy_results).sort()) {
      const [w, s, status] = deploy_results[tool_id];
      const anchor = USER_SCOPE_PATHS[tool_id] ?? "";
      if (status === "deployed" && tool_id === "claude-desktop") {
        const bundles_dir = _claude_desktop_bundles_dir();
        process3.stdout.write(`      ${tool_id.padEnd(15)} \u2192 ${bundles_dir} (${w} bundles)
`);
      } else if (status === "deployed") {
        process3.stdout.write(`      ${tool_id.padEnd(15)} \u2192 ${anchor} (${w} files, ${s} skipped)
`);
      } else if (status === "marker") {
        process3.stdout.write(
          `      ${tool_id.padEnd(15)} \u2192 ${anchor}agent-config.md (${w ? "written" : "skipped"})
`
        );
      } else if (status === "hint") {
        process3.stdout.write(
          `      ${tool_id.padEnd(15)} \u2192 no user-scope convention; use \`agent-config export --tool=${tool_id}\`
`
        );
      } else {
        process3.stdout.write(
          `      ${tool_id.padEnd(15)} \u2192 no global-scope content yet (project-scope install supported)
`
        );
      }
    }
  }
  if (project_root !== null && pathExists(_resolve_settings_read(project_root)) && !isDir(path18.join(project_root, ".agent-src.uncondensed"))) {
    const files_by_tool = _files_by_tool_from_deploy(deploy_results);
    const rc = _update_installed_tools_manifest(project_root, tools, "global", force, files_by_tool);
    if (rc !== 0) return rc;
    const removed_marker = _remove_legacy_consumer_bridge_marker(project_root);
    if (removed_marker !== null && !state.QUIET) {
      const rel = isRelativeTo(removed_marker, project_root) ? path18.relative(project_root, removed_marker) : removed_marker;
      info(`Removed legacy bridge marker: ${rel}`);
    }
    const anchor_paths = _write_per_tool_project_anchors(project_root, tools);
    if (anchor_paths.length > 0 && !state.QUIET) {
      for (const p of anchor_paths) {
        const rel = isRelativeTo(p, project_root) ? path18.relative(project_root, p) : p;
        info(`Project anchor written: ${rel}`);
      }
    }
  }
  try {
    _write_settings_surface_snapshot(installed_version);
  } catch (e) {
    if (!state.QUIET) warn(`settings-surface snapshot failed \u2014 ${String(e)}`);
  }
  if (!state.QUIET) {
    try {
      for (const line of _catalogue_truncation_warnings(deploy_results, project_root)) {
        warn(line);
      }
      const notice = _scoped_migration_notice(deploy_results, project_root, package_root, {
        env: process3.env,
        stdinTty: process3.stdin.isTTY === true,
        stdoutTty: process3.stdout.isTTY === true
      });
      if (notice.length > 0) {
        process3.stdout.write("\n");
        for (const line of notice) info(line);
      }
    } catch {
    }
  }
  if (!state.QUIET) {
    process3.stdout.write("\n");
    success(`Global install completed (v${installed_version}).`);
    process3.stdout.write("\n");
  }
  return 0;
}
function _catalogue_truncation_warnings(deploy_results, project_root) {
  const log_candidates = [
    path18.join(event4u_root(), "state", "skill-catalogue.jsonl"),
    ...project_root ? [path18.join(project_root, OBSERVATION_LOG)] : []
  ];
  const records = log_candidates.flatMap((p) => readObservationLog(p));
  if (records.length === 0) return [];
  const limits = knownHostLimits(records);
  if (limits.size === 0) return [];
  const lines = [];
  for (const tool_id of Object.keys(deploy_results).sort()) {
    const [, , status] = deploy_results[tool_id];
    if (status !== "deployed") continue;
    const limit = limits.get(tool_id);
    if (limit === void 0) continue;
    const anchor_raw = USER_SCOPE_PATHS[tool_id];
    if (!anchor_raw) continue;
    const volume = measureCatalogueVolume(tool_id, expanduser6(anchor_raw));
    const warning = catalogueLimitWarning(volume, limit);
    if (warning !== null) lines.push(warning);
  }
  return lines;
}
function _scoped_migration_notice(deploy_results, project_root, package_root, probe) {
  if (!isInteractiveSession(probe)) return [];
  const log_candidates = [
    path18.join(event4u_root(), "state", "skill-catalogue.jsonl"),
    ...project_root ? [path18.join(project_root, OBSERVATION_LOG)] : []
  ];
  const limits = knownHostLimits(log_candidates.flatMap((p) => readObservationLog(p)));
  if (limits.size === 0) return [];
  const resolved = _resolve_scoped_projection(package_root);
  const settings_path = _resolve_global_settings_path() ?? path18.join(event4u_root(), "settings", SETTINGS_FILE);
  for (const tool_id of Object.keys(deploy_results).sort()) {
    const [, , status] = deploy_results[tool_id];
    if (status !== "deployed") continue;
    const anchor_raw = USER_SCOPE_PATHS[tool_id];
    if (!anchor_raw) continue;
    const volume = measureCatalogueVolume(tool_id, expanduser6(anchor_raw));
    const eligibility = migrationEligibility(
      tool_id,
      resolved.mode,
      volume.skillEntries,
      limits
    );
    if (eligibility.eligible) {
      return migrationPromptLines(tool_id, eligibility, settings_path);
    }
  }
  return [];
}
var SETTINGS_SURFACE_REL = path18.join("state", "settings-surface.json");
var SETTINGS_DELTA_REL = path18.join("state", "settings-delta.json");
function _current_settings_surface(version) {
  const jsonSchema = zodToJsonSchema(settingsSchema, {
    name: "AgentSettings",
    $refStrategy: "none",
    target: "jsonSchema7"
  });
  return flattenSurface(jsonSchema, version);
}
function _write_settings_surface_snapshot(installed_version) {
  const root = event4u_root();
  const surface_path = path18.join(root, SETTINGS_SURFACE_REL);
  const delta_path = path18.join(root, SETTINGS_DELTA_REL);
  const next = _current_settings_surface(installed_version);
  let previous = null;
  try {
    const parsed = JSON.parse(fs21.readFileSync(surface_path, "utf8"));
    if (parsed !== null && typeof parsed === "object" && parsed.entries !== void 0) previous = parsed;
  } catch {
  }
  if (previous !== null && previous.version !== next.version) {
    const delta = computeSurfaceDelta(previous, next);
    if (delta.changes.length > 0) {
      fs21.mkdirSync(path18.dirname(delta_path), { recursive: true, mode: 448 });
      fs21.writeFileSync(delta_path, `${JSON.stringify(delta, null, 2)}
`, { mode: 384 });
      if (!state.QUIET) {
        const counts = {};
        for (const c of delta.changes) counts[c.kind] = (counts[c.kind] ?? 0) + 1;
        const parts = Object.entries(counts).map(([k, v]) => `${v} ${k.replace("_", " ")}`);
        info(
          `Settings surface changed ${delta.oldVersion} \u2192 ${delta.newVersion}: ${parts.join(", ")}. Review with \`agent-config config\` (Settings \u2192 banner) \u2014 nothing was changed automatically.`
        );
      }
    }
  }
  fs21.mkdirSync(path18.dirname(surface_path), { recursive: true, mode: 448 });
  fs21.writeFileSync(surface_path, `${JSON.stringify(next, null, 2)}
`, { mode: 384 });
}
function arrayStrEqual(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
function _merge_tools_aliases(tools, ai) {
  const items = [];
  for (const raw of [tools, ai]) {
    if (!raw) continue;
    for (const piece of raw.split(",")) {
      const stripped = piece.trim();
      if (stripped && !items.includes(stripped)) items.push(stripped);
    }
  }
  return items.length > 0 ? items.join(",") : "all";
}
var PROG = "install.py";
var USAGE = `usage: ${PROG} [-h] [--profile PROFILE] [--user-type USER_TYPE] [--force]
                  [--skip-bridges] [--augment-user-hooks]
                  [--cursor-user-hooks] [--cline-user-hooks]
                  [--windsurf-user-hooks] [--gemini-user-hooks]
                  [--project PROJECT] [--package PACKAGE] [--quiet]
                  [--tools TOOLS] [--ai AI] [--packs PACKS] [--core-only]
                  [--no-smoke] [--global]
                  [--scope {project,global,prompt,auto}]
                  [--layer {global,project,both-acknowledged}]
                  [--custom-path CUSTOM_PATH] [--offline] [--minimal]
                  [--interactive] [--no-ui] [--dry-run]
                  [--apply-payload APPLY_PAYLOAD]
`;
var _STORE_TRUE_FLAGS = {
  "--force": "force",
  "--skip-bridges": "skip_bridges",
  "--augment-user-hooks": "augment_user_hooks",
  "--cursor-user-hooks": "cursor_user_hooks",
  "--cline-user-hooks": "cline_user_hooks",
  "--windsurf-user-hooks": "windsurf_user_hooks",
  "--gemini-user-hooks": "gemini_user_hooks",
  "--quiet": "quiet",
  "--core-only": "core_only",
  "--no-smoke": "no_smoke",
  "--global": "global_install",
  "--offline": "offline",
  "--minimal": "minimal",
  "--settings-only": "minimal",
  "--interactive": "interactive",
  "--no-ui": "no_ui",
  "--dry-run": "dry_run"
};
var _VALUE_FLAGS = {
  "--profile": "profile",
  "--user-type": "user_type",
  "--project": "project",
  "--package": "package",
  "--tools": "tools",
  "--ai": "ai",
  "--packs": "packs",
  "--scope": "scope",
  "--custom-path": "custom_path",
  "--apply-payload": "apply_payload",
  "--layer": "layer"
};
function _argError(msg) {
  process3.stderr.write(USAGE);
  process3.stderr.write(`${PROG}: error: ${msg}
`);
  throw new ArgparseExit2(2);
}
function parse_options(argv) {
  const opts = {
    profile: DEFAULT_PROFILE,
    user_type: "",
    force: false,
    skip_bridges: false,
    augment_user_hooks: false,
    cursor_user_hooks: false,
    cline_user_hooks: false,
    windsurf_user_hooks: false,
    gemini_user_hooks: false,
    project: null,
    package: null,
    quiet: false,
    tools: null,
    ai: null,
    packs: null,
    core_only: false,
    no_smoke: false,
    global_install: false,
    scope: null,
    custom_path: null,
    offline: false,
    minimal: false,
    interactive: false,
    no_ui: false,
    dry_run: false,
    apply_payload: null,
    layer: null
  };
  const positionals = [];
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a === "-h" || a === "--help") {
      process3.stdout.write(USAGE);
      throw new ArgparseExit2(0);
    }
    const eq = a.startsWith("--") ? a.indexOf("=") : -1;
    const flag = eq >= 0 ? a.slice(0, eq) : a;
    const inlineVal = eq >= 0 ? a.slice(eq + 1) : null;
    const storeTrueDest = _STORE_TRUE_FLAGS[flag];
    if (storeTrueDest !== void 0) {
      if (inlineVal !== null) {
        _argError(`argument ${flag}: ignored explicit argument '${inlineVal}'`);
      }
      opts[storeTrueDest] = true;
      i += 1;
      continue;
    }
    const valueDest = _VALUE_FLAGS[flag];
    if (valueDest !== void 0) {
      let value;
      if (inlineVal !== null) {
        value = inlineVal;
      } else {
        if (i + 1 >= argv.length) _argError(`argument ${flag}: expected one argument`);
        value = argv[i + 1];
        i += 1;
      }
      if (flag === "--scope" && !["project", "global", "prompt", "auto"].includes(value)) {
        _argError(
          `argument --scope: invalid choice: '${value}' (choose from 'project', 'global', 'prompt', 'auto')`
        );
      }
      if (flag === "--layer" && !RULE_LAYER_CHOICES.includes(value)) {
        _argError(
          `argument --layer: invalid choice: '${value}' (choose from ${RULE_LAYER_CHOICES.map((c) => `'${c}'`).join(", ")})`
        );
      }
      opts[valueDest] = value;
      i += 1;
      continue;
    }
    if (a.startsWith("-") && a !== "-") {
      _argError(`unrecognized arguments: ${a}`);
    }
    positionals.push(a);
    i += 1;
  }
  if (positionals.length > 0) {
    _argError(`unrecognized arguments: ${positionals.join(" ")}`);
  }
  opts.tools = _merge_tools_aliases(opts.tools, opts.ai);
  const rawPacks = opts.packs;
  opts.packs = typeof rawPacks === "string" ? rawPacks.split(",").map((p) => p.trim()).filter((p) => p) : [];
  if (opts.scope === "global" && opts.custom_path) {
    fail("--custom-path is incompatible with --scope=global");
  }
  if (opts.global_install && opts.custom_path) {
    fail("--custom-path is incompatible with --global");
  }
  if (opts.scope !== null && opts.global_install && opts.scope !== "global") {
    fail(`--scope=${opts.scope} conflicts with --global; pick one`);
  }
  return opts;
}
var _VALID_TOOLS = /* @__PURE__ */ new Set([
  "claude-code",
  "claude-desktop",
  "cursor",
  "windsurf",
  "cline",
  "gemini-cli",
  "copilot",
  "augment",
  "aider",
  "codex",
  "roocode",
  "continue",
  "kilocode",
  "zed",
  "jetbrains",
  "kiro",
  "qoder",
  "opencode",
  "trae",
  "antigravity",
  "codebuddy",
  "droid",
  "warp",
  "all"
]);
function _parse_tools(raw) {
  if (!raw || !raw.trim()) fail("--tools requires a non-empty value");
  const items = raw.split(",").map((s) => s.trim()).filter((s) => s);
  if (items.length === 0) fail("--tools requires at least one ID");
  const unknown = items.filter((s) => !_VALID_TOOLS.has(s));
  if (unknown.length > 0) {
    fail(
      `--tools: unknown ID(s): ${unknown.join(", ")} (valid: ${[..._VALID_TOOLS].sort().join(", ")})`
    );
  }
  if (items.includes("all")) {
    return new Set([..._VALID_TOOLS].filter((t) => t !== "all"));
  }
  return new Set(items);
}
function _tools_was_all(raw) {
  if (!raw || !raw.trim()) return false;
  const items = raw.split(",").map((s) => s.trim()).filter((s) => s);
  return items.includes("all");
}
function _is_tool_enabled(tools, tool_id) {
  return tools.has(tool_id);
}
function _minimal_templates_root() {
  const start = resolvePath(_HERE2);
  const chain = [start];
  let cur = start;
  for (; ; ) {
    const parent = path18.dirname(cur);
    if (parent === cur) break;
    chain.push(parent);
    cur = parent;
  }
  for (const ancestor of chain) {
    const candidate = path18.join(ancestor, "src", "templates", "minimal");
    if (isDir(candidate)) return candidate;
  }
  fail("Could not locate src/templates/minimal/ \u2014 package install is corrupt.");
}
var INSTALL_MODE_MARKER_REL = "agents/.agent-state/install-mode.txt";
function _write_install_mode_marker(project_root, mode) {
  if (mode !== "minimal" && mode !== "full") return;
  const marker = path18.join(project_root, INSTALL_MODE_MARKER_REL);
  try {
    mkdirp(path18.dirname(marker));
    writeText(marker, `${mode}
`);
  } catch {
  }
}
function install_minimal(target_root_in, force, user_type = "") {
  let target_root = resolvePath(target_root_in);
  mkdirp(target_root);
  const parent = path18.dirname(target_root);
  if (parent !== target_root) {
    const existing = find_project_root_with_anchor(parent);
    if (existing !== null && existing[0] !== target_root) {
      const [root, anchor] = existing;
      fail(
        `Refusing to nest an agent-config layer inside an existing project (anchor: ${anchor}). Existing root: ${root}. Remove the parent layer first or run \`--minimal\` outside it.`
      );
    }
  }
  const templates = _minimal_templates_root();
  const settings_src = path18.join(templates, SETTINGS_FILE);
  const overrides_gitkeep_src = path18.join(templates, "overrides-gitkeep");
  const overrides_readme_src = path18.join(templates, "agents-overrides-readme.md");
  if (!isFile(settings_src)) fail(`Bundled minimal settings template missing under ${templates}`);
  if (!isFile(overrides_gitkeep_src) || !isFile(overrides_readme_src)) {
    fail(`Bundled overrides scaffold templates missing under ${templates}`);
  }
  info(`Minimal init \u2192 ${target_root}`);
  const overrides_root = path18.join(target_root, "agents", "overrides");
  mkdirp(overrides_root);
  const gitkeep_body = readText(overrides_gitkeep_src);
  for (const sub of ["rules", "skills", "commands"]) {
    const sub_dir = path18.join(overrides_root, sub);
    mkdirp(sub_dir);
    const gitkeep_dst = path18.join(sub_dir, ".gitkeep");
    if (pathExists(gitkeep_dst) && !force) {
      skip(`agents/overrides/${sub}/.gitkeep already exists (use --force to overwrite)`);
    } else {
      writeText(gitkeep_dst, gitkeep_body);
      success(`Wrote agents/overrides/${sub}/.gitkeep`);
    }
  }
  const readme_dst = path18.join(overrides_root, "README.md");
  if (pathExists(readme_dst) && !force) {
    skip("agents/overrides/README.md already exists (use --force to overwrite)");
  } else {
    writeText(readme_dst, readText(overrides_readme_src));
    success("Wrote agents/overrides/README.md");
  }
  if (user_type) {
    const settings_dst = _canonical_settings_target(target_root);
    if (pathExists(settings_dst) && !force) {
      skip(`${SETTINGS_FILE} already exists (use --force to overwrite)`);
    } else {
      const body = readText(settings_src).replace(/\s+$/, "") + `

# --- Personal (step-9 user-type axis) ---
personal:
  user_type: ${user_type}
`;
      mkdirp(path18.dirname(settings_dst));
      writeText(settings_dst, body);
      success(`Wrote ${SETTINGS_FILE} (user_type=${user_type})`);
    }
  }
  const removed_marker = _remove_legacy_consumer_bridge_marker(target_root);
  if (removed_marker !== null) {
    const rel = isRelativeTo(removed_marker, target_root) ? path18.relative(target_root, removed_marker) : removed_marker;
    success(`Removed legacy bridge marker: ${rel}`);
  }
  _write_install_mode_marker(target_root, "minimal");
  if (!state.QUIET) {
    process3.stderr.write(
      "\u2139\uFE0F   Minimal install \u2014 run `agent-config install --force` to add AGENTS.md, bridges, and tool integrations.\n"
    );
  }
  if (!state.QUIET) {
    process3.stdout.write("\n");
    info("Next steps:");
    info("  \u2022 Ensure `agent-config` is on $PATH: npm install -g @event4u/agent-config");
    info("  \u2022 Drop project-scoped overrides under `agents/overrides/{rules,skills,commands}/`.");
    info("  \u2022 Run `agent-config doctor` to verify the layer is picked up.");
  }
  return 0;
}
var _INTERACTIVE_USER_TYPES = [
  ["creator", "Content / writing / publishing"],
  ["founder", "Early-stage company building"],
  ["consultant", "Advisory / strategy / discovery"],
  ["gtm", "Sales / marketing / revenue ops"],
  ["finance", "Finance / FP&A / unit economics"],
  ["ops", "Operations / incident / compliance"],
  ["developer", "Engineering / code-heavy work"]
];
var _INTERACTIVE_STACKS = [
  ["none", "No code project / pure content"],
  ["laravel", "PHP / Laravel"],
  ["nextjs", "TypeScript / Next.js / React"],
  ["python", "Python / FastAPI / Django"],
  ["symfony", "PHP / Symfony"],
  ["generic", "Other / mixed stack"]
];
var _INTERACTIVE_VERBOSITIES = [
  ["quiet", "Telegraph / minimal output"],
  ["normal", "Default verbosity"],
  ["verbose", "Full intent announcements + play-by-play"]
];
var _LOCAL_CONFIG_FILE = ".agent-config.local.json";
function _interactive_prompt_choice(label, options) {
  process3.stdout.write("\n");
  process3.stdout.write(`  ${label}
`);
  options.forEach(([key, blurb], idx) => {
    process3.stdout.write(`    ${idx + 1}. ${key}  \u2014 ${blurb}
`);
  });
  process3.stdout.write("\n");
  for (; ; ) {
    const raw = _read_line(`  Choice [1-${options.length}, default 1]: `);
    if (raw === null) return options[0][0];
    if (!raw) return options[0][0];
    if (/^[0-9]+$/.test(raw)) {
      const n = parseInt(raw, 10);
      if (n >= 1 && n <= options.length) return options[n - 1][0];
    }
    for (const [key] of options) {
      if (raw.toLowerCase() === key) return key;
    }
    process3.stdout.write(
      `  \u26A0\uFE0F  Pick a number 1-${options.length} or one of: ${options.map(([k]) => k).join(", ")}.
`
    );
  }
}
function run_interactive_init(project_root, force) {
  if (!process3.stdin.isTTY) {
    warn(
      `--interactive requested but stdin is not a TTY; skipping the prompt. Re-run interactively or hand-edit ${_LOCAL_CONFIG_FILE}.`
    );
    return 0;
  }
  const target = path18.join(project_root, _LOCAL_CONFIG_FILE);
  if (pathExists(target) && !force) {
    warn(
      `${_LOCAL_CONFIG_FILE} already exists; re-run with --force to overwrite. Skipping interactive init.`
    );
    return 0;
  }
  process3.stdout.write("\n");
  info("Interactive init \u2014 captures user-type / stack / verbosity");
  info("(forward-compatible stub; runtime filtering activates with step-9)");
  const user_type = _interactive_prompt_choice("Primary user type:", _INTERACTIVE_USER_TYPES);
  const stack = _interactive_prompt_choice("Project stack:", _INTERACTIVE_STACKS);
  const verbosity = _interactive_prompt_choice("Verbosity profile:", _INTERACTIVE_VERBOSITIES);
  const payload = {
    $schema: "https://github.com/event4u-app/agent-config/src/scripts/schemas/local-config.schema.json",
    version: 1,
    user_type,
    stack,
    verbosity,
    universal_skills_contract: "docs/contracts/universal-skills.md"
  };
  try {
    writeText(target, jsonDumpsIndent(payload, 2) + "\n");
  } catch (exc) {
    warn(`Could not write ${target}: ${String(exc)}`);
    return 1;
  }
  success(`Wrote ${path18.relative(project_root, target)} (${user_type} / ${stack} / ${verbosity})`);
  return 0;
}
var _WIZARD_READY_RE = /^WIZARD_READY (http:\/\/(?:127\.0\.0\.1|localhost):\d+\/\S*)\r?$/;
var _WIZARD_TIMEOUTS = [10, 20, 40, 80];
function _wizard_should_launch(opts) {
  if (opts.no_ui) return [false, "--no-ui flag set"];
  const env_no_ui = (process3.env["AGENT_CONFIG_NO_UI"] ?? "").trim();
  if (env_no_ui && env_no_ui !== "0") return [false, "AGENT_CONFIG_NO_UI env set"];
  if ((process3.env["CI"] ?? "").trim()) return [false, "CI environment detected"];
  if (!process3.stdout.isTTY) return [false, "stdout is not a TTY"];
  const tools_raw = opts.tools;
  if (tools_raw && !_tools_was_all(tools_raw)) {
    return [false, "explicit --tools= selection (headless install)"];
  }
  return [true, ""];
}
function _wizard_cli_dist(_project_root) {
  const package_root = path18.dirname(path18.dirname(path18.dirname(resolvePath(_HERE2))));
  const cli = path18.join(package_root, "dist", "cli", "agent-config.js");
  return pathExists(cli) ? cli : null;
}
function _server_info_path() {
  return path18.join(os8.homedir(), ".event4u", "agent-config", "local-server.json");
}
function _pid_is_agent_config(pid) {
  let res;
  try {
    res = spawnSync2("ps", ["-p", String(pid), "-o", "command="], {
      encoding: "utf-8",
      timeout: 5e3
    });
  } catch {
    return false;
  }
  if (res.error) return false;
  return (res.stdout || "").toLowerCase().includes("agent-config");
}
function unlinkMissingOk(p) {
  try {
    fs21.unlinkSync(p);
  } catch {
  }
}
function pidAlive(pid) {
  try {
    process3.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === "EPERM";
  }
}
function _kill_stale_wizard_server() {
  const p = _server_info_path();
  let infoObj;
  try {
    infoObj = JSON.parse(readText(p));
  } catch {
    return;
  }
  const pid = infoObj["pid"];
  if (typeof pid !== "number" || !Number.isInteger(pid)) {
    unlinkMissingOk(p);
    return;
  }
  if (!pidAlive(pid)) {
    unlinkMissingOk(p);
    return;
  }
  if (!_pid_is_agent_config(pid)) return;
  try {
    process3.kill(pid, "SIGTERM");
  } catch {
    unlinkMissingOk(p);
    return;
  }
  let exited = false;
  for (let n = 0; n < 30; n += 1) {
    if (!pidAlive(pid)) {
      exited = true;
      break;
    }
    sleepMs(100);
  }
  if (!exited) {
    try {
      process3.kill(pid, "SIGKILL");
    } catch {
    }
  }
  unlinkMissingOk(p);
  process3.stdout.write("(Stopped the previous wizard server.)\n");
}
function sleepMs(ms) {
  const end = Date.now() + ms;
  const buf = new Int32Array(new SharedArrayBuffer(4));
  while (Date.now() < end) {
    Atomics.wait(buf, 0, 0, Math.max(1, end - Date.now()));
  }
}
function _wizard_spawn(project_root, pass_project_root = true) {
  _kill_stale_wizard_server();
  const cli = _wizard_cli_dist(project_root);
  if (cli === null) {
    process3.stdout.write(
      "(Wizard not available \u2014 CLI bundle not built. Run 'npm run build' at the package root to produce dist/cli/.)\n"
    );
    return 0;
  }
  const cmd = ["node", cli, "install", "--no-open"];
  if (pass_project_root) {
    cmd.push("--project-root", project_root);
  }
  const env = { ...process3.env };
  return _wizard_run_sync(cmd, env, cli);
}
function _wizard_run_sync(cmd, env, cli) {
  const total = _WIZARD_TIMEOUTS.reduce((a, b) => a + b, 0);
  const log_path = path18.join(
    os8.tmpdir(),
    `agent-config-wizard-${process3.pid}-${Date.now()}.log`
  );
  let child;
  let log_fd = null;
  try {
    log_fd = fs21.openSync(log_path, "w");
    child = spawn(cmd[0], cmd.slice(1), {
      env,
      detached: true,
      stdio: ["ignore", log_fd, log_fd]
    });
    child.on("error", () => {
    });
    child.unref();
  } catch (exc) {
    process3.stdout.write(
      `(Wizard failed to start: ${String(exc)}; run 'node ${cli} install --no-open' manually.)
`
    );
    return 0;
  } finally {
    if (log_fd !== null) {
      try {
        fs21.closeSync(log_fd);
      } catch {
      }
    }
  }
  const read_log = () => {
    try {
      return readText(log_path);
    } catch {
      return "";
    }
  };
  const deadline = Date.now() + total * 1e3;
  let matched_url = null;
  for (; ; ) {
    for (const line of read_log().split("\n")) {
      const m = _WIZARD_READY_RE.exec(line + "\n");
      if (m) {
        matched_url = m[1];
        break;
      }
    }
    if (matched_url !== null) break;
    const pid = child.pid;
    if (pid === void 0 || !pidAlive(pid)) break;
    if (Date.now() >= deadline) break;
    sleepMs(200);
  }
  if (matched_url === null) {
    const logLines = read_log().split("\n").filter((l) => l !== "");
    const tail = logLines.length ? logLines.slice(-20).join("\n  ") : "(no output captured)";
    process3.stdout.write(
      `(Wizard server did not report ready within ${Math.trunc(total)}s; run 'node ${cli} install --no-open' manually.)
  Last output:
  ${tail}
`
    );
    return 0;
  }
  process3.stdout.write("\n");
  process3.stdout.write(`Setup wizard ready: ${matched_url}
`);
  _openBrowser(matched_url);
  process3.stdout.write(
    "(Wizard server keeps running in the background \u2014 finish the wizard in the browser tab; the next install run stops any stale server.)\n"
  );
  return 0;
}
function _openBrowser(url) {
  try {
    const opener = process3.platform === "darwin" ? ["open", [url]] : process3.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : ["xdg-open", [url]];
    spawnSync2(opener[0], opener[1], { stdio: "ignore" });
  } catch {
  }
}
function _dry_run_summary(opts) {
  const target = resolvePath(
    opts.custom_path || opts.project || process3.env["PROJECT_ROOT"] || process3.cwd()
  );
  const [will_launch, why_not] = _wizard_should_launch(opts);
  process3.stdout.write("\n");
  process3.stdout.write("[dry-run] Plan summary \u2014 no files written, no subprocesses spawned:\n");
  process3.stdout.write(`  profile:     ${opts.profile}
`);
  process3.stdout.write(`  user-type:   ${opts.user_type || "(none)"}
`);
  process3.stdout.write(`  scope:       ${opts.scope || (opts.global_install ? "global" : "auto")}
`);
  process3.stdout.write(`  tools:       ${opts.tools || "all"}
`);
  process3.stdout.write(`  target:      ${target}
`);
  process3.stdout.write(`  minimal:     ${pyBool(opts.minimal)}
`);
  process3.stdout.write(`  force:       ${pyBool(opts.force)}
`);
  process3.stdout.write(`  offline:     ${pyBool(opts.offline)}
`);
  if (will_launch) {
    process3.stdout.write("  wizard:      Would auto-launch (pass --no-ui to suppress).\n");
  } else {
    process3.stdout.write(`  wizard:      Suppressed (${why_not}).
`);
  }
  if (opts.global_install) {
    let preview = {};
    try {
      preview = _preview_global_reap(
        _parse_tools(opts.tools || "all"),
        _resolve_package_root_for_global()
      );
    } catch {
      preview = {};
    }
    const total = Object.values(preview).reduce((a, v) => a + v.length, 0);
    process3.stdout.write("\n");
    if (total === 0) {
      process3.stdout.write("  reap (cleanup): nothing to reap \u2014 no stale deployed files.\n");
    } else {
      process3.stdout.write(`  reap (cleanup): would remove ${total} stale file(s):
`);
      for (const tool_id of Object.keys(preview).sort()) {
        for (const p of preview[tool_id]) {
          process3.stdout.write(`      ${tool_id}: ${p}
`);
        }
      }
    }
  }
  process3.stdout.write("\n");
  return 0;
}
function pyBool(v) {
  return v ? "True" : "False";
}
function _apply_payload_preview(payload, opts) {
  const schema_version = payload["schema_version"] ?? "<missing>";
  const target = resolvePath(
    opts.custom_path || opts.project || process3.env["PROJECT_ROOT"] || process3.cwd()
  );
  process3.stdout.write("\n");
  process3.stdout.write(
    "[apply-payload] Plan summary \u2014 no files written, no subprocesses spawned:\n"
  );
  process3.stdout.write(`  schema:      ${schema_version}
`);
  if (schema_version === "wizard-v2") {
    const tools = payload["tools"] || [];
    const packs = payload["packs"] || [];
    const settings = payload["settings"] || {};
    const scope_to_project = Boolean(payload["scope_to_project_only"] ?? false);
    process3.stdout.write(`  tools:       ${tools.length ? tools.join(",") : "(none)"}
`);
    process3.stdout.write(`  packs:       ${packs.length ? packs.join(",") : "(base)"}
`);
    process3.stdout.write(`  settings:    ${Object.keys(settings).length} top-level key(s)
`);
    process3.stdout.write(`  scope:       ${scope_to_project ? "project" : "global"}
`);
  } else if (schema_version === "installer-v1") {
    const ai_tools = payload["ai_tools"] || [];
    const configs = payload["configs"] || {};
    process3.stdout.write(`  ai_tools:    ${ai_tools.length ? ai_tools.join(",") : "(none)"}
`);
    process3.stdout.write(`  configs:     ${Object.keys(configs).length} tool config(s)
`);
  } else {
    process3.stdout.write(`  error:       unsupported schema_version: ${pyRepr(schema_version)}
`);
    process3.stdout.write("\n");
    return 2;
  }
  process3.stdout.write(`  target:      ${target}
`);
  process3.stdout.write(`  dry_run:     ${pyBool(Boolean(payload["dry_run"] ?? opts.dry_run))}
`);
  process3.stdout.write("\n");
  return 0;
}
function pyRepr(v) {
  if (typeof v === "string") return `'${v.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  if (v === null || v === void 0) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  return String(v);
}
function main2(argv) {
  const opts = parse_options(argv);
  state.QUIET = opts.quiet;
  if (opts.apply_payload) {
    const payload_path = resolvePath(opts.apply_payload);
    if (!isFile(payload_path)) fail(`--apply-payload path not found: ${payload_path}`);
    let payload;
    try {
      payload = JSON.parse(readText(payload_path));
    } catch (exc) {
      fail(`--apply-payload JSON parse error: ${String(exc)}`);
    }
    if (!_isPlainObject2(payload)) fail("--apply-payload root must be a JSON object");
    const pl = payload;
    const schema_version = pl["schema_version"];
    if (schema_version !== "wizard-v2" && schema_version !== "installer-v1") {
      fail(
        `--apply-payload schema_version must be 'wizard-v2' or 'installer-v1', got ${pyRepr(schema_version)}`
      );
    }
    if (schema_version === "wizard-v2") {
      const tools = pl["tools"];
      if (Array.isArray(tools) && tools.length > 0) {
        opts.tools = tools.filter((t) => typeof t === "string").join(",");
      }
      if (Boolean(pl["scope_to_project_only"] ?? false)) {
        opts.scope = "project";
      } else {
        opts.scope = "global";
      }
      const settings = pl["settings"];
      if (_isPlainObject2(settings)) {
        const rule_loading_tier = settings["rule_loading_tier"] || settings["cost_profile"];
        if (typeof rule_loading_tier === "string" && rule_loading_tier) {
          opts.profile = rule_loading_tier;
        }
        const personal = settings["personal"];
        if (_isPlainObject2(personal)) {
          const user_type = personal["user_type"];
          if (typeof user_type === "string" && user_type) {
            opts.user_type = user_type;
          }
        }
      }
      const packs = pl["packs"];
      if (Array.isArray(packs)) {
        opts.packs = packs.filter((p) => typeof p === "string");
      }
    } else if (schema_version === "installer-v1") {
      const ai_tools = pl["ai_tools"];
      if (Array.isArray(ai_tools) && ai_tools.length > 0) {
        opts.tools = ai_tools.filter((t) => typeof t === "string").join(",");
      }
    }
    if (Boolean(pl["dry_run"] ?? false)) {
      opts.dry_run = true;
    }
    if (opts.dry_run) {
      return _apply_payload_preview(pl, opts);
    }
    state.PROGRESS_NDJSON = true;
    state.QUIET = true;
  }
  if (opts.offline) {
    process3.env["AGENT_CONFIG_OFFLINE"] = "1";
    process3.env["AGENT_CONFIG_NO_UPDATE_CHECK"] = "1";
  }
  if (!SUPPORTED_PROFILES.includes(opts.profile)) {
    fail(`Unsupported profile: ${opts.profile}. Supported: ${SUPPORTED_PROFILES.join(", ")}`);
  }
  if (opts.dry_run) {
    return _dry_run_summary(opts);
  }
  {
    const [will_launch, why_not] = _wizard_should_launch(opts);
    if (will_launch) {
      if (!state.QUIET) info("Setup wizard will launch automatically after install.");
    } else if (!state.QUIET) {
      info(`Setup wizard auto-launch disabled (${why_not}).`);
    }
  }
  if (opts.minimal) {
    const target_root = resolvePath(
      opts.custom_path || opts.project || process3.env["PROJECT_ROOT"] || process3.cwd()
    );
    const minimal_package_root = path18.dirname(
      path18.dirname(path18.dirname(_minimal_templates_root()))
    );
    const validated_user_type = _validate_user_type(minimal_package_root, opts.user_type);
    return install_minimal(target_root, opts.force, validated_user_type);
  }
  const detect_root = resolvePath(opts.project || process3.env["PROJECT_ROOT"] || process3.cwd());
  const [detected, detect_reason] = detect_scope(detect_root);
  const custom_path = opts.custom_path ? resolvePath(opts.custom_path) : null;
  const scope = _resolve_scope(opts, detected, detect_reason, custom_path);
  _enforce_consumer_global_only(scope);
  _enforce_not_source_repo(scope, detect_root);
  let parsed_tools = _parse_tools(opts.tools);
  const tools_was_all = _tools_was_all(opts.tools);
  parsed_tools = _validate_scope(parsed_tools, scope, tools_was_all);
  if (parsed_tools.has("claude-code") && !_gate_rule_layer_overlap(detect_root, opts.layer, opts.dry_run)) {
    return 2;
  }
  const wizard_handoff = _wizard_should_launch(opts)[0];
  if (scope === "global") {
    const artefacts = _detect_legacy_for_migration(detect_root);
    if (artefacts.length > 0 && (wizard_handoff || _prompt_migrate_to_global(detect_root, artefacts))) {
      const rc3 = _run_migrate_to_global(detect_root);
      if (rc3 !== 0) return rc3;
    }
    const rc2 = install_global(parsed_tools, opts.force, detect_root, opts.core_only);
    _emit_progress_terminal(rc2);
    if (rc2 === 0 && wizard_handoff) {
      return _wizard_spawn(detect_root, false);
    }
    return rc2;
  }
  const project_root = custom_path || resolvePath(opts.project || process3.env["PROJECT_ROOT"] || process3.cwd());
  const is_first_run = !pathExists(path18.join(project_root, SETTINGS_FILE));
  const rc = _main_project_install(opts, project_root, parsed_tools, is_first_run);
  if (rc === 0 && opts.interactive) {
    run_interactive_init(project_root, opts.force);
  }
  _emit_progress_terminal(rc);
  return rc;
}
function _propose_modules_config(project_root, is_first_run) {
  if (!is_first_run || state.QUIET || !process3.stdin.isTTY || !process3.stdout.isTTY) return;
  let candidates;
  try {
    candidates = detect_module_roots(project_root);
  } catch {
    return;
  }
  if (!candidates || candidates.length === 0) return;
  process3.stdout.write("\n");
  info("Module-root candidates detected \u2014 propose `modules:` block");
  info("Paste into .agent-project-settings.yml to enable module-aware skills (or skip; the block stays opt-in).");
  process3.stdout.write("\n");
  process3.stdout.write("  modules:\n");
  process3.stdout.write("    enabled: true\n");
  process3.stdout.write("    root_paths: [" + candidates.map((c) => c.path).join(", ") + "]\n");
  const primary_ns = candidates.find((c) => c.namespace_template_guess)?.namespace_template_guess ?? "";
  if (primary_ns) {
    process3.stdout.write(`    namespace_template: '${primary_ns}'
`);
  }
  process3.stdout.write("    agent_folder: agents\n");
  process3.stdout.write("    skip_dirs: [.module-template, .example]\n");
  process3.stdout.write("\n");
  info(
    "Re-run anytime via `./scripts-run src/scripts/propose_modules_config` (installed under <package>/src/scripts/)."
  );
}
function _read_consumer_auto_switch(project_root) {
  let data;
  try {
    data = load_agent_settings({ project_path: _resolve_settings_read(project_root) });
  } catch {
    return "suggest";
  }
  const model = _isPlainObject2(data) ? data["model"] : null;
  const value = _isPlainObject2(model) ? model["auto_switch"] : null;
  if (typeof value === "string" && ["auto", "suggest", "off"].includes(value.trim().toLowerCase())) {
    return value.trim().toLowerCase();
  }
  return "suggest";
}
function _team_setup_hint_line(project_root) {
  let data;
  try {
    data = load_agent_settings({ project_path: _resolve_settings_read(project_root) });
  } catch {
    data = {};
  }
  const ai_team = _isPlainObject2(data) ? data["ai_team"] : null;
  const flag = _isPlainObject2(ai_team) ? ai_team["suppress_setup_hint"] : null;
  const suppressed = flag === true || typeof flag === "string" && ["true", "yes", "on", "1"].includes(flag.trim().toLowerCase());
  if (suppressed) return null;
  return "  \u2022 Claude Code team mode (optional cross-model review via the official codex plugin): run `agent-config doctor --check team` for setup status.";
}
function finalize_claude_model_tiers(project_root) {
  const claude_skills = path18.join(project_root, ".claude", "skills");
  const augment_skills = path18.join(project_root, ".augment", "skills");
  if (!isDir(claude_skills) || !isDir(augment_skills)) return 0;
  if (_read_consumer_auto_switch(project_root) !== "auto") return 0;
  let rendered = 0;
  const entries = fs21.readdirSync(claude_skills).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  for (const name of entries) {
    const entry = path18.join(claude_skills, name);
    const src_dir = path18.join(augment_skills, name);
    const src_md = path18.join(src_dir, "SKILL.md");
    let tier;
    try {
      tier = read_model_tier(src_md);
    } catch {
      tier = null;
    }
    if (tier === null || !(tier in TIER_TO_CLAUDE_MODEL) || !isDir(src_dir)) continue;
    if (isSymlink(entry) || isFile(entry)) {
      fs21.unlinkSync(entry);
    } else if (isDir(entry)) {
      fs21.rmSync(entry, { recursive: true, force: true });
    }
    mkdirp(entry);
    const srcFiles = fs21.readdirSync(src_dir).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
    for (const fname of srcFiles) {
      if (fname === "SKILL.md") {
        writeText(
          path18.join(entry, "SKILL.md"),
          render_native_model_md(readText(src_md), tier)
        );
      } else {
        fs21.symlinkSync(
          path18.join("../../../.augment/skills", name, fname),
          path18.join(entry, fname)
        );
      }
    }
    rendered += 1;
  }
  if (rendered && !state.QUIET) {
    info(
      `Applied native model: to ${rendered} model-tier skill(s) in .claude/skills/ (model.auto_switch=auto)`
    );
  }
  return rendered;
}
function _main_project_install(opts, project_root, parsed_tools, is_first_run) {
  let package_root;
  let package_type;
  if (opts.package) {
    package_root = resolvePath(opts.package);
    if (!pathExists(path18.join(package_root, "src", "config", "profiles", "minimal.ini"))) {
      fail(`Invalid --package path (missing src/config/profiles/minimal.ini): ${package_root}`);
    }
    package_type = detect_package_type_for_project(project_root, package_root);
  } else {
    package_root = detect_package_root(project_root);
    package_type = detect_package_type(package_root);
  }
  if (!state.QUIET) {
    process3.stdout.write("\n");
    info("Agent Config \u2014 Project Bridge Installer");
    info(`Project:  ${project_root}`);
    info(`Package:  ${package_root}`);
    info(`Type:     ${package_type}`);
    info(`Profile:  ${opts.profile}`);
    if (opts.user_type) info(`UserType: ${opts.user_type}`);
    process3.stdout.write("\n");
  }
  ensure_agent_settings(project_root, package_root, opts.profile, opts.force, opts.user_type, opts.packs ?? null);
  _write_install_mode_marker(project_root, "full");
  const tools = parsed_tools;
  const merged_keys_by_tool = {};
  if (!opts.skip_bridges) {
    merged_keys_by_tool["augment"] = [
      ...ensure_vscode_bridge(project_root, package_type, opts.force),
      ...ensure_augment_bridge(project_root, opts.force)
    ];
    if (_is_tool_enabled(tools, "claude-code")) {
      merged_keys_by_tool["claude-code"] = ensure_claude_bridge(project_root, opts.force);
    }
    if (_is_tool_enabled(tools, "cursor")) {
      merged_keys_by_tool["cursor"] = ensure_cursor_bridge(project_root, opts.force);
    }
    if (_is_tool_enabled(tools, "cline")) ensure_cline_bridge(project_root, opts.force);
    if (_is_tool_enabled(tools, "windsurf")) {
      merged_keys_by_tool["windsurf"] = ensure_windsurf_bridge(project_root, opts.force);
    }
    if (_is_tool_enabled(tools, "gemini-cli")) {
      merged_keys_by_tool["gemini-cli"] = ensure_gemini_bridge(project_root, opts.force);
    }
    if (_is_tool_enabled(tools, "copilot")) ensure_copilot_bridge(project_root, opts.force);
    if (_is_tool_enabled(tools, "roocode")) ensure_roocode_bridge(project_root, opts.force);
    if (_is_tool_enabled(tools, "claude-desktop")) ensure_claude_desktop_bridge(project_root, opts.force);
    if (_is_tool_enabled(tools, "aider")) ensure_aider_bridge(project_root, opts.force);
    if (_is_tool_enabled(tools, "codex")) ensure_codex_bridge(project_root, opts.force);
    if (_is_tool_enabled(tools, "continue")) ensure_continue_bridge(project_root, opts.force);
    if (_is_tool_enabled(tools, "kilocode")) ensure_kilocode_bridge(project_root, opts.force);
    if (_is_tool_enabled(tools, "zed")) ensure_zed_bridge(project_root, opts.force);
    if (_is_tool_enabled(tools, "jetbrains")) ensure_jetbrains_bridge(project_root, opts.force);
    if (_is_tool_enabled(tools, "kiro")) ensure_kiro_bridge(project_root, opts.force);
  }
  if (opts.augment_user_hooks) {
    (merged_keys_by_tool["augment"] ??= []).push(...ensure_augment_user_hooks(package_root, opts.force));
  }
  if (opts.cursor_user_hooks && _is_tool_enabled(tools, "cursor")) {
    (merged_keys_by_tool["cursor"] ??= []).push(...ensure_cursor_user_hooks(package_root, opts.force));
  }
  if (opts.cline_user_hooks && _is_tool_enabled(tools, "cline")) {
    ensure_cline_user_hooks(package_root, opts.force);
  }
  if (opts.windsurf_user_hooks && _is_tool_enabled(tools, "windsurf")) {
    (merged_keys_by_tool["windsurf"] ??= []).push(...ensure_windsurf_user_hooks(package_root, opts.force));
  }
  if (opts.gemini_user_hooks && _is_tool_enabled(tools, "gemini-cli")) {
    (merged_keys_by_tool["gemini-cli"] ??= []).push(...ensure_gemini_user_hooks(package_root, opts.force));
  }
  if (state.PROGRESS_NDJSON && !opts.skip_bridges) {
    const ordered = [...tools].sort();
    const total = ordered.length;
    ordered.forEach((tool_id, i) => {
      _emit_progress({ type: "file", file: tool_id, status: "deployed", written: i + 1, total });
    });
  }
  if (!opts.skip_bridges && !opts.no_smoke) {
    if (!state.QUIET) {
      process3.stdout.write("\n");
      info("Smoke-testing installed hook bridges (dry-run)");
    }
    _smoke_test_hooks(project_root, package_root);
  }
  if (!opts.skip_bridges) {
    const files_by_tool = _files_by_tool_from_bridges(parsed_tools, project_root, "project");
    const rc = _update_installed_tools_manifest(
      project_root,
      parsed_tools,
      "project",
      opts.force,
      files_by_tool,
      merged_keys_by_tool
    );
    if (rc !== 0) return rc;
  }
  if (!opts.skip_bridges && _is_tool_enabled(tools, "claude-code")) {
    finalize_claude_model_tiers(project_root);
  }
  if (!state.QUIET) {
    process3.stdout.write("\n");
    success("Done.");
    if (is_first_run) {
      process3.stdout.write("\n");
      process3.stdout.write("  Try these 3 prompts with your agent:\n");
      process3.stdout.write('    1. "Refactor this function"   \u2192 agent analyzes first\n');
      process3.stdout.write('    2. "Add caching to this"      \u2192 agent asks instead of guessing\n');
      process3.stdout.write('    3. "Implement this feature"   \u2192 agent respects your codebase\n');
      process3.stdout.write("\n");
      process3.stdout.write("  Next steps:\n");
      process3.stdout.write("    \u2022 Commit .agent-settings.yml and bridge files to your repo\n");
      process3.stdout.write("    \u2022 New team members run `npx @event4u/agent-config init` \u2014 done\n");
      process3.stdout.write("    \u2022 Inspect hook coverage: ./agent-config hooks:status\n");
      process3.stdout.write(
        "    \u2022 Full walkthrough: https://github.com/event4u-app/agent-config/blob/main/docs/getting-started.md\n"
      );
      process3.stdout.write("\n");
    } else {
      process3.stdout.write(
        "  Re-run complete. Walkthrough: https://github.com/event4u-app/agent-config/blob/main/docs/getting-started.md\n"
      );
      process3.stdout.write("\n");
    }
    if (_is_tool_enabled(tools, "claude-code")) {
      const team_hint = _team_setup_hint_line(project_root);
      if (team_hint !== null) {
        process3.stdout.write(team_hint + "\n");
        process3.stdout.write("\n");
      }
    }
  }
  _propose_modules_config(project_root, is_first_run);
  const will_launch = _wizard_should_launch(opts)[0];
  if (will_launch) {
    return _wizard_spawn(project_root);
  }
  return 0;
}
function _resolvedArgv1() {
  if (process3.argv[1] === void 0) return void 0;
  try {
    return fs21.realpathSync(path18.resolve(process3.argv[1]));
  } catch {
    return path18.resolve(process3.argv[1]);
  }
}
var _argv1 = _resolvedArgv1();
var _isCliEntry2 = _argv1 !== void 0 && import.meta.url === pathToFileURL2(_argv1).href;
if (_isCliEntry2 || _argv1 === _HERE2) {
  try {
    process3.exitCode = main2(process3.argv.slice(2));
  } catch (e) {
    if (e instanceof SystemExitError || e instanceof ArgparseExit2) {
      process3.exitCode = e.code;
    } else {
      throw e;
    }
  }
}
export {
  AIDER_MARKER,
  ArgparseExit2 as ArgparseExit,
  CLAUDE_DESKTOP_MARKER,
  CLINE_DISPATCHER_BINDINGS,
  CODEX_MARKER,
  CONTINUE_MARKER,
  CURSOR_DISPATCHER_BINDINGS,
  DEFAULT_PROFILE,
  GEMINI_DISPATCHER_BINDINGS,
  GLOBAL_AGENT_SETTINGS_PATH,
  GLOBAL_USER_SETTINGS_PATH,
  JETBRAINS_MARKER,
  KILOCODE_MARKER,
  KIRO_MARKER,
  PROJECT_BRIDGE_MARKERS,
  ROOCODE_MARKER,
  RULE_LAYER_CHOICES,
  SETTINGS_FILE,
  SUPPORTED_PROFILES,
  SystemExitError,
  USER_SCOPE_PATHS,
  WINDSURF_DISPATCHER_BINDINGS,
  ZED_MARKER,
  _VALID_TOOLS,
  _append_unknown_legacy,
  _apply_claude_flat_command_wrappers,
  _apply_payload_preview,
  _bridge_marker,
  _canonical_settings_target,
  _catalogue_truncation_warnings,
  _compute_active_pack_ids,
  _copy_dir_dereferencing_symlinks,
  _current_settings_surface,
  _deploy_global_content,
  _detect_legacy_for_migration,
  _dry_run_summary,
  _files_by_tool_from_bridges,
  _files_by_tool_from_deploy,
  _format_global_root_for_marker,
  _gate_rule_layer_overlap,
  _inject_packs,
  _is_agent_config_source_repo,
  _is_tool_enabled,
  _load_packs_registry,
  _merge_tools_aliases,
  _parse_legacy_settings,
  _parse_profile_ini,
  _parse_tools,
  _preview_global_reap,
  _prune_lab_modules,
  _prune_modules_by,
  _prune_scoped_modules,
  _render_template,
  _replace_template_value,
  _replace_template_value_raw,
  _resolve_global_rule_scope,
  _resolve_global_settings_doc,
  _resolve_scope,
  _resolve_scoped_projection,
  _resolve_settings_read,
  _rule_filter_for_source,
  _scoped_migration_notice,
  _team_setup_hint_line,
  _tools_was_all,
  _validate_scope,
  _verify_deploy_targets,
  _wizard_should_launch,
  _write_settings_surface_snapshot,
  _yaml_scalar,
  deep_merge,
  detect_package_type,
  detect_package_type_for_project,
  detect_scope,
  ensure_cline_bridge,
  ensure_cursor_bridge,
  ensure_gemini_bridge,
  ensure_windsurf_bridge,
  finalize_claude_model_tiers,
  jsonDumpsCompact,
  jsonDumpsIndent,
  main2 as main,
  parse_options,
  state
};
