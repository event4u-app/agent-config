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
    var isAlias = (node2) => !!node2 && typeof node2 === "object" && node2[NODE_TYPE] === ALIAS;
    var isDocument = (node2) => !!node2 && typeof node2 === "object" && node2[NODE_TYPE] === DOC;
    var isMap = (node2) => !!node2 && typeof node2 === "object" && node2[NODE_TYPE] === MAP;
    var isPair = (node2) => !!node2 && typeof node2 === "object" && node2[NODE_TYPE] === PAIR;
    var isScalar = (node2) => !!node2 && typeof node2 === "object" && node2[NODE_TYPE] === SCALAR;
    var isSeq = (node2) => !!node2 && typeof node2 === "object" && node2[NODE_TYPE] === SEQ;
    function isCollection(node2) {
      if (node2 && typeof node2 === "object")
        switch (node2[NODE_TYPE]) {
          case MAP:
          case SEQ:
            return true;
        }
      return false;
    }
    function isNode(node2) {
      if (node2 && typeof node2 === "object")
        switch (node2[NODE_TYPE]) {
          case ALIAS:
          case MAP:
          case SCALAR:
          case SEQ:
            return true;
        }
      return false;
    }
    var hasAnchor = (node2) => (isScalar(node2) || isCollection(node2)) && !!node2.anchor;
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
    function visit(node2, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node2)) {
        const cd = visit_(null, node2.contents, visitor_, Object.freeze([node2]));
        if (cd === REMOVE)
          node2.contents = null;
      } else
        visit_(null, node2, visitor_, Object.freeze([]));
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    function visit_(key, node2, visitor, path39) {
      const ctrl = callVisitor(key, node2, visitor, path39);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path39, ctrl);
        return visit_(key, ctrl, visitor, path39);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node2)) {
          path39 = Object.freeze(path39.concat(node2));
          for (let i = 0; i < node2.items.length; ++i) {
            const ci = visit_(i, node2.items[i], visitor, path39);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node2.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node2)) {
          path39 = Object.freeze(path39.concat(node2));
          const ck = visit_("key", node2.key, visitor, path39);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node2.key = null;
          const cv = visit_("value", node2.value, visitor, path39);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node2.value = null;
        }
      }
      return ctrl;
    }
    async function visitAsync(node2, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node2)) {
        const cd = await visitAsync_(null, node2.contents, visitor_, Object.freeze([node2]));
        if (cd === REMOVE)
          node2.contents = null;
      } else
        await visitAsync_(null, node2, visitor_, Object.freeze([]));
    }
    visitAsync.BREAK = BREAK;
    visitAsync.SKIP = SKIP;
    visitAsync.REMOVE = REMOVE;
    async function visitAsync_(key, node2, visitor, path39) {
      const ctrl = await callVisitor(key, node2, visitor, path39);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path39, ctrl);
        return visitAsync_(key, ctrl, visitor, path39);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node2)) {
          path39 = Object.freeze(path39.concat(node2));
          for (let i = 0; i < node2.items.length; ++i) {
            const ci = await visitAsync_(i, node2.items[i], visitor, path39);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node2.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node2)) {
          path39 = Object.freeze(path39.concat(node2));
          const ck = await visitAsync_("key", node2.key, visitor, path39);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node2.key = null;
          const cv = await visitAsync_("value", node2.value, visitor, path39);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node2.value = null;
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
    function callVisitor(key, node2, visitor, path39) {
      if (typeof visitor === "function")
        return visitor(key, node2, path39);
      if (identity.isMap(node2))
        return visitor.Map?.(key, node2, path39);
      if (identity.isSeq(node2))
        return visitor.Seq?.(key, node2, path39);
      if (identity.isPair(node2))
        return visitor.Pair?.(key, node2, path39);
      if (identity.isScalar(node2))
        return visitor.Scalar?.(key, node2, path39);
      if (identity.isAlias(node2))
        return visitor.Alias?.(key, node2, path39);
      return void 0;
    }
    function replaceNode(key, path39, node2) {
      const parent = path39[path39.length - 1];
      if (identity.isCollection(parent)) {
        parent.items[key] = node2;
      } else if (identity.isPair(parent)) {
        if (key === "key")
          parent.key = node2;
        else
          parent.value = node2;
      } else if (identity.isDocument(parent)) {
        parent.contents = node2;
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
            const [version2] = parts;
            if (version2 === "1.1" || version2 === "1.2") {
              this.yaml.version = version2;
              return true;
            } else {
              const isValid = /^\d+\.\d+$/.test(version2);
              onError(6, `Unsupported YAML version ${version2}`, isValid);
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
          } catch (error2) {
            onError(String(error2));
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
          visit.visit(doc.contents, (_key, node2) => {
            if (identity.isNode(node2) && node2.tag)
              tags[node2.tag] = true;
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
    function anchorIsValid(anchor2) {
      if (/[\x00-\x19\s,[\]{}]/.test(anchor2)) {
        const sa = JSON.stringify(anchor2);
        const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
        throw new Error(msg);
      }
      return true;
    }
    function anchorNames(root) {
      const anchors = /* @__PURE__ */ new Set();
      visit.visit(root, {
        Value(_key, node2) {
          if (node2.anchor)
            anchors.add(node2.anchor);
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
          const anchor2 = findNewAnchor(prefix, prevAnchors);
          prevAnchors.add(anchor2);
          return anchor2;
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
              const error2 = new Error("Failed to resolve repeated object (this should not happen)");
              error2.source = source;
              throw error2;
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
            Node: (_key, node2) => {
              if (identity.isAlias(node2) || identity.hasAnchor(node2))
                nodes.push(node2);
            }
          });
          if (ctx)
            ctx.aliasResolveCache = nodes;
        }
        let found = void 0;
        for (const node2 of nodes) {
          if (node2 === this)
            break;
          if (node2.anchor === this.source)
            found = node2;
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
    function getAliasCount(doc, node2, anchors2) {
      if (identity.isAlias(node2)) {
        const source = node2.resolve(doc);
        const anchor2 = anchors2 && source && anchors2.get(source);
        return anchor2 ? anchor2.count * anchor2.aliasCount : 0;
      } else if (identity.isCollection(node2)) {
        let count = 0;
        for (const item of node2.items) {
          const c = getAliasCount(doc, item, anchors2);
          if (c > count)
            count = c;
        }
        return count;
      } else if (identity.isPair(node2)) {
        const kc = getAliasCount(doc, node2.key, anchors2);
        const vc = getAliasCount(doc, node2.value, anchors2);
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
          const node3 = new Scalar.Scalar(value);
          if (ref)
            ref.node = node3;
          return node3;
        }
        tagObj = value instanceof Map ? schema[identity.MAP] : Symbol.iterator in Object(value) ? schema[identity.SEQ] : schema[identity.MAP];
      }
      if (onTagObj) {
        onTagObj(tagObj);
        delete ctx.onTagObj;
      }
      const node2 = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar.Scalar(value);
      if (tagName)
        node2.tag = tagName;
      else if (!tagObj.default)
        node2.tag = tagObj.tag;
      if (ref)
        ref.node = node2;
      return node2;
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
    function collectionFromPath(schema, path39, value) {
      let v = value;
      for (let i = path39.length - 1; i >= 0; --i) {
        const k = path39[i];
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
    var isEmptyPath = (path39) => path39 == null || typeof path39 === "object" && !!path39[Symbol.iterator]().next().done;
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
      addIn(path39, value) {
        if (isEmptyPath(path39))
          this.add(value);
        else {
          const [key, ...rest] = path39;
          const node2 = this.get(key, true);
          if (identity.isCollection(node2))
            node2.addIn(rest, value);
          else if (node2 === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
      /**
       * Removes a value from the collection.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path39) {
        const [key, ...rest] = path39;
        if (rest.length === 0)
          return this.delete(key);
        const node2 = this.get(key, true);
        if (identity.isCollection(node2))
          return node2.deleteIn(rest);
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path39, keepScalar) {
        const [key, ...rest] = path39;
        const node2 = this.get(key, true);
        if (rest.length === 0)
          return !keepScalar && identity.isScalar(node2) ? node2.value : node2;
        else
          return identity.isCollection(node2) ? node2.getIn(rest, keepScalar) : void 0;
      }
      hasAllNullValues(allowScalar) {
        return this.items.every((node2) => {
          if (!identity.isPair(node2))
            return false;
          const n = node2.value;
          return n == null || allowScalar && identity.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
        });
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       */
      hasIn(path39) {
        const [key, ...rest] = path39;
        if (rest.length === 0)
          return this.has(key);
        const node2 = this.get(key, true);
        return identity.isCollection(node2) ? node2.hasIn(rest) : false;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path39, value) {
        const [key, ...rest] = path39;
        if (rest.length === 0) {
          this.set(key, value);
        } else {
          const node2 = this.get(key, true);
          if (identity.isCollection(node2))
            node2.setIn(rest, value);
          else if (node2 === void 0 && this.schema)
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
      const literal2 = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
      if (!value)
        return literal2 ? "|\n" : ">\n";
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
      if (!literal2) {
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
    function stringifyProps(node2, tagObj, { anchors: anchors$1, doc }) {
      if (!doc.directives)
        return "";
      const props = [];
      const anchor2 = (identity.isScalar(node2) || identity.isCollection(node2)) && node2.anchor;
      if (anchor2 && anchors.anchorIsValid(anchor2)) {
        anchors$1.add(anchor2);
        props.push(`&${anchor2}`);
      }
      const tag = node2.tag ?? (tagObj.default ? null : tagObj.tag);
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
      const node2 = identity.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
      tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node2));
      const props = stringifyProps(node2, tagObj, ctx);
      if (props.length > 0)
        ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
      const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node2, ctx, onComment, onChompKeep) : identity.isScalar(node2) ? stringifyString.stringifyString(node2, ctx, onComment, onChompKeep) : node2.toString(ctx, onComment, onChompKeep);
      if (!props)
        return str;
      return identity.isScalar(node2) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
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
    var merge2 = {
      identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
      default: "key",
      tag: "tag:yaml.org,2002:merge",
      test: /^<<$/,
      resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
        addToJSMap: addMergeToJSMap
      }),
      stringify: () => MERGE_KEY
    };
    var isMergeKey = (ctx, key) => (merge2.identify(key) || identity.isScalar(key) && (!key.type || key.type === Scalar.Scalar.PLAIN) && merge2.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge2.tag && tag.default);
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
    exports.merge = merge2;
  }
});

// node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = __commonJS({
  "node_modules/yaml/dist/nodes/addPairToJSMap.js"(exports) {
    "use strict";
    var log = require_log();
    var merge2 = require_merge();
    var stringify = require_stringify();
    var identity = require_identity();
    var toJS = require_toJS();
    function addPairToJSMap(ctx, map, { key, value }) {
      if (identity.isNode(key) && key.addToJSMap)
        key.addToJSMap(ctx, map, value);
      else if (merge2.isMergeKey(ctx, key))
        merge2.addMergeToJSMap(ctx, map, value);
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
        for (const node2 of ctx.anchors.keys())
          strCtx.anchors.add(node2.anchor);
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
        const node2 = it?.value;
        return (!keepScalar && identity.isScalar(node2) ? node2.value : node2) ?? void 0;
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
    var string3 = {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str) => str,
      stringify(item, ctx, onComment, onChompKeep) {
        ctx = Object.assign({ actualString: true }, ctx);
        return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
      }
    };
    exports.string = string3;
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
      stringify(node2) {
        const num = Number(node2.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node2);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
      resolve(str) {
        const node2 = new Scalar.Scalar(parseFloat(str));
        const dot = str.indexOf(".");
        if (dot !== -1 && str[str.length - 1] === "0")
          node2.minFractionDigits = str.length - dot - 1;
        return node2;
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
    function intStringify(node2, radix, prefix) {
      const { value } = node2;
      if (intIdentify(value) && value >= 0)
        return prefix + value.toString(radix);
      return stringifyNumber.stringifyNumber(node2);
    }
    var intOct = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^0o[0-7]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
      stringify: (node2) => intStringify(node2, 8, "0o")
    };
    var int2 = {
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
      stringify: (node2) => intStringify(node2, 16, "0x")
    };
    exports.int = int2;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/yaml/dist/schema/core/schema.js
var require_schema = __commonJS({
  "node_modules/yaml/dist/schema/core/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null3 = require_null();
    var seq = require_seq();
    var string3 = require_string();
    var bool = require_bool();
    var float = require_float();
    var int2 = require_int();
    var schema = [
      map.map,
      seq.seq,
      string3.string,
      _null3.nullTag,
      bool.boolTag,
      int2.intOct,
      int2.int,
      int2.intHex,
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
      stringify(node2) {
        const num = Number(node2.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node2);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
      resolve(str) {
        const node2 = new Scalar.Scalar(parseFloat(str.replace(/_/g, "")));
        const dot = str.indexOf(".");
        if (dot !== -1) {
          const f = str.substring(dot + 1).replace(/_/g, "");
          if (f[f.length - 1] === "0")
            node2.minFractionDigits = f.length;
        }
        return node2;
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
    function intStringify(node2, radix, prefix) {
      const { value } = node2;
      if (intIdentify(value)) {
        const str = value.toString(radix);
        return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
      }
      return stringifyNumber.stringifyNumber(node2);
    }
    var intBin = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "BIN",
      test: /^[-+]?0b[0-1_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
      stringify: (node2) => intStringify(node2, 2, "0b")
    };
    var intOct = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^[-+]?0[0-7_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
      stringify: (node2) => intStringify(node2, 8, "0")
    };
    var int2 = {
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
      stringify: (node2) => intStringify(node2, 16, "0x")
    };
    exports.int = int2;
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
    function stringifySexagesimal(node2) {
      let { value } = node2;
      let num = (n) => n;
      if (typeof value === "bigint")
        num = (n) => BigInt(n);
      else if (isNaN(value) || !isFinite(value))
        return stringifyNumber.stringifyNumber(node2);
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
        let date2 = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
        const tz = match[8];
        if (tz && tz !== "Z") {
          let d = parseSexagesimal(tz, false);
          if (Math.abs(d) < 30)
            d *= 60;
          date2 -= 6e4 * d;
        }
        return new Date(date2);
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
    var _null3 = require_null();
    var seq = require_seq();
    var string3 = require_string();
    var binary = require_binary();
    var bool = require_bool2();
    var float = require_float2();
    var int2 = require_int2();
    var merge2 = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var set = require_set();
    var timestamp = require_timestamp();
    var schema = [
      map.map,
      seq.seq,
      string3.string,
      _null3.nullTag,
      bool.trueTag,
      bool.falseTag,
      int2.intBin,
      int2.intOct,
      int2.int,
      int2.intHex,
      float.floatNaN,
      float.floatExp,
      float.float,
      binary.binary,
      merge2.merge,
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
    var _null3 = require_null();
    var seq = require_seq();
    var string3 = require_string();
    var bool = require_bool();
    var float = require_float();
    var int2 = require_int();
    var schema = require_schema();
    var schema$1 = require_schema2();
    var binary = require_binary();
    var merge2 = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var schema$2 = require_schema3();
    var set = require_set();
    var timestamp = require_timestamp();
    var schemas = /* @__PURE__ */ new Map([
      ["core", schema.schema],
      ["failsafe", [map.map, seq.seq, string3.string]],
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
      int: int2.int,
      intHex: int2.intHex,
      intOct: int2.intOct,
      intTime: timestamp.intTime,
      map: map.map,
      merge: merge2.merge,
      null: _null3.nullTag,
      omap: omap.omap,
      pairs: pairs.pairs,
      seq: seq.seq,
      set: set.set,
      timestamp: timestamp.timestamp
    };
    var coreKnownTags = {
      "tag:yaml.org,2002:binary": binary.binary,
      "tag:yaml.org,2002:merge": merge2.merge,
      "tag:yaml.org,2002:omap": omap.omap,
      "tag:yaml.org,2002:pairs": pairs.pairs,
      "tag:yaml.org,2002:set": set.set,
      "tag:yaml.org,2002:timestamp": timestamp.timestamp
    };
    function getTags(customTags, schemaName, addMergeTag) {
      const schemaTags = schemas.get(schemaName);
      if (schemaTags && !customTags) {
        return addMergeTag && !schemaTags.includes(merge2.merge) ? schemaTags.concat(merge2.merge) : schemaTags.slice();
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
        tags = tags.concat(merge2.merge);
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
    var string3 = require_string();
    var tags = require_tags();
    var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    var Schema = class _Schema {
      constructor({ compat, customTags, merge: merge2, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
        this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
        this.name = typeof schema === "string" && schema || "core";
        this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
        this.tags = tags.getTags(customTags, this.name, merge2);
        this.toStringOptions = toStringDefaults ?? null;
        Object.defineProperty(this, identity.MAP, { value: map.map });
        Object.defineProperty(this, identity.SCALAR, { value: string3.string });
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
        let { version: version2 } = opt;
        if (options?._directives) {
          this.directives = options._directives.atDocument();
          if (this.directives.yaml.explicit)
            version2 = this.directives.yaml.version;
        } else
          this.directives = new directives.Directives({ version: version2 });
        this.setSchema(version2, options);
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
      addIn(path39, value) {
        if (assertCollection(this.contents))
          this.contents.addIn(path39, value);
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
      createAlias(node2, name) {
        if (!node2.anchor) {
          const prev = anchors.anchorNames(this);
          node2.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          !name || prev.has(name) ? anchors.findNewAnchor(name || "a", prev) : name;
        }
        return new Alias.Alias(node2.anchor);
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
        const node2 = createNode.createNode(value, tag, ctx);
        if (flow && identity.isCollection(node2))
          node2.flow = true;
        setAnchors();
        return node2;
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
      deleteIn(path39) {
        if (Collection.isEmptyPath(path39)) {
          if (this.contents == null)
            return false;
          this.contents = null;
          return true;
        }
        return assertCollection(this.contents) ? this.contents.deleteIn(path39) : false;
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
      getIn(path39, keepScalar) {
        if (Collection.isEmptyPath(path39))
          return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
        return identity.isCollection(this.contents) ? this.contents.getIn(path39, keepScalar) : void 0;
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
      hasIn(path39) {
        if (Collection.isEmptyPath(path39))
          return this.contents !== void 0;
        return identity.isCollection(this.contents) ? this.contents.hasIn(path39) : false;
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
      setIn(path39, value) {
        if (Collection.isEmptyPath(path39)) {
          this.contents = value;
        } else if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, Array.from(path39), value);
        } else if (assertCollection(this.contents)) {
          this.contents.setIn(path39, value);
        }
      }
      /**
       * Change the YAML version and schema used by the document.
       * A `null` version disables support for directives, explicit tags, anchors, and aliases.
       * It also requires the `schema` option to be given as a `Schema` instance value.
       *
       * Overrides all previously set schema options.
       */
      setSchema(version2, options = {}) {
        if (typeof version2 === "number")
          version2 = String(version2);
        let opt;
        switch (version2) {
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
              this.directives.yaml.version = version2;
            else
              this.directives = new directives.Directives({ version: version2 });
            opt = { resolveKnownTags: true, schema: "core" };
            break;
          case null:
            if (this.directives)
              delete this.directives;
            opt = null;
            break;
          default: {
            const sv = JSON.stringify(version2);
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
    var prettifyError = (src, lc) => (error2) => {
      if (error2.pos[0] === -1)
        return;
      error2.linePos = error2.pos.map((pos) => lc.linePos(pos));
      const { line, col } = error2.linePos[0];
      error2.message += ` at line ${line}, column ${col}`;
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
        const end = error2.linePos[1];
        if (end?.line === line && end.col > col) {
          count = Math.max(1, Math.min(end.col - col, 80 - ci));
        }
        const pointer = " ".repeat(ci) + "^".repeat(count);
        error2.message += `:

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
      let anchor2 = null;
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
            if (anchor2 || tag)
              newlineAfterProp = token;
            hasSpace = true;
            break;
          case "anchor":
            if (anchor2)
              onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
            if (token.source.endsWith(":"))
              onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
            anchor2 = token;
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
            if (anchor2 || tag)
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
        anchor: anchor2,
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
        const { start, key, sep: sep11, value } = collItem;
        const keyProps = resolveProps.resolveProps(start, {
          indicator: "explicit-key-ind",
          next: key ?? sep11?.[0],
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
          if (!keyProps.anchor && !keyProps.tag && !sep11) {
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
        const valueProps = resolveProps.resolveProps(sep11 ?? [], {
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
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep11, null, valueProps, onError);
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
        const node2 = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
        offset = node2.range[2];
        seq.items.push(node2);
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
        let sep11 = "";
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
                comment += sep11 + cb;
              sep11 = "";
              break;
            }
            case "newline":
              if (comment)
                sep11 += source;
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
        const { start, key, sep: sep11, value } = collItem;
        const props = resolveProps.resolveProps(start, {
          flow: fcName,
          indicator: "explicit-key-ind",
          next: key ?? sep11?.[0],
          offset,
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (!props.found) {
          if (!props.anchor && !props.tag && !sep11 && !value) {
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
        if (!isMap && !sep11 && !props.found) {
          const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep11, null, props, onError);
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
          const valueProps = resolveProps.resolveProps(sep11 ?? [], {
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
              if (sep11)
                for (const st of sep11) {
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
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep11, null, valueProps, onError) : null;
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
        const { anchor: anchor2, newlineAfterProp: nl } = props;
        const lastProp = anchor2 && tagToken ? anchor2.offset > tagToken.offset ? anchor2 : tagToken : anchor2 ?? tagToken;
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
      const node2 = identity.isNode(res) ? res : new Scalar.Scalar(res);
      node2.range = coll.range;
      node2.tag = tagName;
      if (tag?.format)
        node2.format = tag.format;
      return node2;
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
      let sep11 = "";
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
          value += sep11 + indent.slice(trimIndent) + content;
          sep11 = "\n";
        } else if (indent.length > trimIndent || content[0] === "	") {
          if (sep11 === " ")
            sep11 = "\n";
          else if (!prevMoreIndented && sep11 === "\n")
            sep11 = "\n\n";
          value += sep11 + indent.slice(trimIndent) + content;
          sep11 = "\n";
          prevMoreIndented = true;
        } else if (content === "") {
          if (sep11 === "\n")
            value += "\n";
          else
            sep11 = "\n";
        } else {
          value += sep11 + content;
          sep11 = " ";
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
      let error2 = -1;
      for (let i = 1; i < source.length; ++i) {
        const ch = source[i];
        if (!chomp && (ch === "-" || ch === "+"))
          chomp = ch;
        else {
          const n = Number(ch);
          if (!indent && n)
            indent = n;
          else if (error2 === -1)
            error2 = offset + i;
        }
      }
      if (error2 !== -1)
        onError(error2, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
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
      let sep11 = " ";
      let pos = first.lastIndex;
      line.lastIndex = pos;
      while (match = line.exec(source)) {
        if (match[1] === "") {
          if (sep11 === "\n")
            res += sep11;
          else
            sep11 = "\n";
        } else {
          res += sep11 + match[1];
          sep11 = " ";
        }
        pos = line.lastIndex;
      }
      const last = /[ \t]*(.*)/sy;
      last.lastIndex = pos;
      match = last.exec(source);
      return res + sep11 + (match?.[1] ?? "");
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
      } catch (error2) {
        const msg = error2 instanceof Error ? error2.message : String(error2);
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
      const { spaceBefore, comment, anchor: anchor2, tag } = props;
      let node2;
      let isSrcToken = true;
      switch (token.type) {
        case "alias":
          node2 = composeAlias(ctx, token, onError);
          if (anchor2 || tag)
            onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
          break;
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "block-scalar":
          node2 = composeScalar.composeScalar(ctx, token, tag, onError);
          if (anchor2)
            node2.anchor = anchor2.source.substring(1);
          break;
        case "block-map":
        case "block-seq":
        case "flow-collection":
          try {
            node2 = composeCollection.composeCollection(CN, ctx, token, props, onError);
            if (anchor2)
              node2.anchor = anchor2.source.substring(1);
          } catch (error2) {
            const message = error2 instanceof Error ? error2.message : String(error2);
            onError(token, "RESOURCE_EXHAUSTION", message);
          }
          break;
        default: {
          const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
          onError(token, "UNEXPECTED_TOKEN", message);
          isSrcToken = false;
        }
      }
      node2 ?? (node2 = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
      if (anchor2 && node2.anchor === "")
        onError(anchor2, "BAD_ALIAS", "Anchor cannot be an empty string");
      if (atKey && ctx.options.stringKeys && (!identity.isScalar(node2) || typeof node2.value !== "string" || node2.tag && node2.tag !== "tag:yaml.org,2002:str")) {
        const msg = "With stringKeys, all keys must be strings";
        onError(tag ?? token, "NON_STRING_KEY", msg);
      }
      if (spaceBefore)
        node2.spaceBefore = true;
      if (comment) {
        if (token.type === "scalar" && token.source === "")
          node2.comment = comment;
        else
          node2.commentBefore = comment;
      }
      if (ctx.options.keepSourceTokens && isSrcToken)
        node2.srcToken = token;
      return node2;
    }
    function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor: anchor2, tag, end }, onError) {
      const token = {
        type: "scalar",
        offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
        indent: -1,
        source: ""
      };
      const node2 = composeScalar.composeScalar(ctx, token, tag, onError);
      if (anchor2) {
        node2.anchor = anchor2.source.substring(1);
        if (node2.anchor === "")
          onError(anchor2, "BAD_ALIAS", "Anchor cannot be an empty string");
      }
      if (spaceBefore)
        node2.spaceBefore = true;
      if (comment) {
        node2.comment = comment;
        node2.range[2] = end;
      }
      return node2;
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
            const error2 = new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
            if (this.atDirectives || !this.doc)
              this.errors.push(error2);
            else
              this.doc.errors.push(error2);
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
    function stringifyItem({ start, key, sep: sep11, value }) {
      let res = "";
      for (const st of start)
        res += st.source;
      if (key)
        res += stringifyToken(key);
      if (sep11)
        for (const st of sep11)
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
    visit.itemAtPath = (cst, path39) => {
      let item = cst;
      for (const [field, index] of path39) {
        const tok = item?.[field];
        if (tok && "items" in tok) {
          item = tok.items[index];
        } else
          return void 0;
      }
      return item;
    };
    visit.parentCollection = (cst, path39) => {
      const parent = visit.itemAtPath(cst, path39.slice(0, -1));
      const field = path39[path39.length - 1][0];
      const coll = parent?.[field];
      if (coll && "items" in coll)
        return coll;
      throw new Error("Parent collection not found");
    };
    function _visit(path39, item, visitor) {
      let ctrl = visitor(item, path39);
      if (typeof ctrl === "symbol")
        return ctrl;
      for (const field of ["key", "value"]) {
        const token = item[field];
        if (token && "items" in token) {
          for (let i = 0; i < token.items.length; ++i) {
            const ci = _visit(Object.freeze(path39.concat([[field, i]])), token.items[i], visitor);
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
            ctrl = ctrl(item, path39);
        }
      }
      return typeof ctrl === "function" ? ctrl(item, path39) : ctrl;
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
      *pop(error2) {
        const token = error2 ?? this.stack.pop();
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
          let sep11;
          if (scalar.end) {
            sep11 = scalar.end;
            sep11.push(this.sourceToken);
            delete scalar.end;
          } else
            sep11 = [this.sourceToken];
          const map = {
            type: "block-map",
            offset: scalar.offset,
            indent: scalar.indent,
            items: [{ start, key: scalar, sep: sep11 }]
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
                  const sep11 = it.sep;
                  sep11.push(this.sourceToken);
                  delete it.key;
                  delete it.sep;
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key, sep: sep11 }]
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
              const fs40 = this.flowScalar(this.type);
              if (atNextItem || it.value) {
                map.items.push({ start, key: fs40, sep: [] });
                this.onKeyLine = true;
              } else if (it.sep) {
                this.stack.push(fs40);
              } else {
                Object.assign(it, { key: fs40, sep: [] });
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
              const fs40 = this.flowScalar(this.type);
              if (!it || it.value)
                fc.items.push({ start: [], key: fs40, sep: [] });
              else if (it.sep)
                this.stack.push(fs40);
              else
                Object.assign(it, { key: fs40, sep: [] });
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
            const sep11 = fc.end.splice(1, fc.end.length);
            sep11.push(this.sourceToken);
            const map = {
              type: "block-map",
              offset: fc.offset,
              indent: fc.indent,
              items: [{ start, key: fc, sep: sep11 }]
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
    function parse7(src, reviver, options) {
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
    exports.parse = parse7;
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
import { spawn, spawnSync as spawnSync3 } from "node:child_process";
import * as crypto5 from "node:crypto";
import * as fs39 from "node:fs";
import * as os14 from "node:os";
import * as path38 from "node:path";
import process4 from "node:process";
import { fileURLToPath as fileURLToPath8, pathToFileURL as pathToFileURL2 } from "node:url";

// src/scripts/_lib/json_pointers.ts
import { createHash } from "node:crypto";

// src/scripts/_lib/json_merge.ts
function isPlainObject(v) {
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
function deepMerge(base, overlay) {
  const result = deepcopy(base);
  for (const key of Object.keys(overlay)) {
    const value = overlay[key];
    if (Object.prototype.hasOwnProperty.call(result, key) && isPlainObject(result[key]) && isPlainObject(value)) {
      result[key] = deepMerge(result[key], value);
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
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every(
      (k) => Object.prototype.hasOwnProperty.call(b, k) && jsonEqual(a[k], b[k])
    );
  }
  return false;
}

// src/scripts/_lib/host_hook_merge.ts
var HOOK_SIGNATURES = {
  "~/.augment/settings.json": "augment-dispatcher.sh",
  ".cursor/hooks.json": "dispatch:hook --platform cursor",
  "~/.cursor/hooks.json": "cursor-dispatcher.sh",
  ".windsurf/hooks.json": "dispatch:hook --platform windsurf",
  "~/.codeium/windsurf/hooks.json": "windsurf-dispatcher.sh",
  ".gemini/settings.json": "dispatch:hook --platform gemini",
  "~/.gemini/settings.json": "gemini-dispatcher.sh"
};
function entryCommands(entry) {
  if (!isPlainObject(entry)) return [];
  const out = [];
  if (typeof entry["command"] === "string") out.push(entry["command"]);
  const nested = entry["hooks"];
  if (Array.isArray(nested)) {
    for (const inner of nested) {
      if (isPlainObject(inner) && typeof inner["command"] === "string") {
        out.push(inner["command"]);
      }
    }
  }
  return out;
}
function isManagedEntry(entry, signature) {
  if (signature === "") return false;
  return entryCommands(entry).some((cmd) => cmd.includes(signature));
}
function mergeEventEntries(existing, incoming, signature) {
  const kept = existing.filter((entry) => !isManagedEntry(entry, signature));
  return [...kept.map((e) => deepcopy(e)), ...incoming.map((e) => deepcopy(e))];
}
function mergeHookEvents(existingHooks, patchHooks, signature) {
  if (!isPlainObject(existingHooks)) return deepcopy(patchHooks);
  const out = deepcopy(existingHooks);
  for (const event of Object.keys(patchHooks)) {
    const incoming = patchHooks[event];
    const current = out[event];
    if (!Array.isArray(incoming)) {
      out[event] = deepcopy(incoming);
      continue;
    }
    out[event] = mergeEventEntries(Array.isArray(current) ? current : [], incoming, signature);
  }
  return out;
}
function mergeHostConfig(existing, patch, signature, deepMergeFn) {
  const merged = deepMergeFn(existing, patch);
  const patchHooks = patch["hooks"];
  if (signature === "" || !isPlainObject(patchHooks)) return merged;
  merged["hooks"] = mergeHookEvents(existing["hooks"], patchHooks, signature);
  return merged;
}

// src/scripts/_lib/json_pointers.ts
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
  const entry_signature = options.entry_signature ?? "";
  const entries = [];
  for (const [key, value] of Object.entries(overlay)) {
    const pointer = `${prefix}/${_escape_segment(String(key))}`;
    if (_is_plain_object(value)) {
      if (Object.keys(value).length === 0) {
        entries.push({ json_pointer: pointer, value_hash: null });
      } else {
        entries.push(
          ...collect_pointers(value, {
            prefix: pointer,
            include_arrays,
            entry_signature
          })
        );
      }
    } else if (Array.isArray(value)) {
      if (entry_signature !== "" && pointer.startsWith("/hooks/")) {
        entries.push({
          json_pointer: pointer,
          value_hash: null,
          entry_signature
        });
      } else {
        entries.push({
          json_pointer: pointer,
          value_hash: include_arrays ? value_hash(value) : null
        });
      }
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
  const pointers = collect_pointers(overlay, {
    entry_signature: HOOK_SIGNATURES[file_label] ?? ""
  });
  return pointers.map((entry) => ({
    file: file_label,
    json_pointer: entry.json_pointer,
    value_hash: entry.value_hash,
    ...entry.entry_signature === void 0 ? {} : { entry_signature: entry.entry_signature }
  }));
}

// src/scripts/_lib/reserved_name_sweep.ts
import * as fs from "node:fs";
import * as path from "node:path";
function sweepReservedNames(commandsDir, currentFiles, isBuiltinName, recordedFiles) {
  const reserved = [];
  const foreign = [];
  let entries = [];
  try {
    entries = fs.readdirSync(commandsDir).filter((f) => f.endsWith(".md"));
  } catch {
    return { reserved, foreign };
  }
  for (const fname of entries.sort()) {
    const slug = fname.slice(0, -".md".length);
    if (!isBuiltinName(slug)) continue;
    const rel = `commands/${fname}`;
    const ours2 = currentFiles.has(rel) || recordedFiles.has(rel);
    if (!ours2) {
      foreign.push(slug);
      continue;
    }
    fs.rmSync(path.join(commandsDir, fname), { force: true });
    currentFiles.delete(rel);
    reserved.push(slug);
  }
  return { reserved, foreign };
}

// src/scripts/_lib/host_env_write.ts
var YAML = __toESM(require_dist(), 1);
import * as fs2 from "node:fs";
import * as path2 from "node:path";
var MAX_CONCURRENT_SUBAGENTS = 64;
var WRITABLE_HOST_ENV = [
  { variable: "BASH_MAX_OUTPUT_LENGTH", settingsKey: "host_environment.request_size_caps.bash_max_output_length" },
  { variable: "MAX_MCP_OUTPUT_TOKENS", settingsKey: "host_environment.request_size_caps.max_mcp_output_tokens" },
  { variable: "CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS", settingsKey: "subagents.max_parallel", max: MAX_CONCURRENT_SUBAGENTS }
];
var SETTINGS_CANDIDATES = [
  ["agents", "settings", ".agent-settings.yml"],
  [".agent-settings.yml"]
];
function readSettingsDoc(projectRoot) {
  for (const parts of SETTINGS_CANDIDATES) {
    const p = path2.join(projectRoot, ...parts);
    let text;
    try {
      text = fs2.readFileSync(p, "utf-8");
    } catch {
      continue;
    }
    let doc;
    try {
      doc = YAML.parse(text, { version: "1.1" });
    } catch {
      return null;
    }
    return doc === null || doc === void 0 || typeof doc !== "object" ? null : doc;
  }
  return null;
}
function hostEnvBlock(settings) {
  const out = {};
  for (const { variable, settingsKey, max } of WRITABLE_HOST_ENV) {
    let v = settings;
    for (const part of settingsKey.split(".")) {
      v = v !== null && typeof v === "object" ? v[part] : void 0;
    }
    if (typeof v !== "number" || !Number.isSafeInteger(v) || v <= 0) continue;
    if (max !== void 0 && v > max) continue;
    out[variable] = String(v);
  }
  return Object.keys(out).length === 0 ? null : out;
}
function withHostEnv(bridge, projectRoot, announce) {
  const env = hostEnvBlock(readSettingsDoc(projectRoot));
  if (env === null) return bridge;
  announce(`.claude/settings.json: wrote ${Object.keys(env).join(", ")} (request-size and concurrency caps)`);
  return { ...bridge, env };
}

// src/scripts/_lib/json_python_parity.ts
function jsonStrNoAscii(s) {
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
  if (typeof value === "string") return jsonStrNoAscii(value);
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
      (k) => `${pad}${jsonStrNoAscii(k)}: ${_dumpIndent(obj[k], indent, depth + 1)}`
    );
    return `{
${items.join(",\n")}
${closePad}}`;
  }
  return jsonStrNoAscii(String(value));
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
    return "{" + Object.keys(obj).map((k) => `${jsonStrNoAscii(k)}:${jsonDumpsCompact(obj[k])}`).join(",") + "}";
  }
  return jsonStrNoAscii(String(value));
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
  "design",
  "design-consent",
  "design-login",
  "design-revoke",
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
import * as fs4 from "node:fs";
import * as os2 from "node:os";
import * as path4 from "node:path";
import { fileURLToPath } from "node:url";

// src/scripts/_lib/user_global_paths.ts
import * as fs3 from "node:fs";
import * as os from "node:os";
import * as path3 from "node:path";
var _PARTIAL_SUFFIX = ".event4u-partial-";
var EVENT4U_HOME_ENV = "EVENT4U_CONFIG_HOME";
var DEFAULT_EVENT4U_ROOT_RELATIVE = path3.join(".event4u", "agent-config");
var LEGACY_XDG_ROOT_RELATIVE = path3.join(".config", "agent-config");
function expanduser(p) {
  if (p === "~") {
    return os.homedir();
  }
  if (p.startsWith("~/") || process.platform === "win32" && p.startsWith("~\\")) {
    return path3.join(os.homedir(), p.slice(2));
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
  return path3.join(os.homedir(), DEFAULT_EVENT4U_ROOT_RELATIVE);
}
function legacy_xdg_root() {
  return path3.join(os.homedir(), LEGACY_XDG_ROOT_RELATIVE);
}
function resolve_with_fallback(relative_name, options = {}) {
  if (is_absolute_like_python(relative_name)) {
    throw new Error(
      `resolve_with_fallback expects a relative path, got '${relative_name}'`
    );
  }
  const new_path = path3.join(event4u_root(options.env ?? null), relative_name);
  if (fs3.existsSync(new_path)) {
    return new_path;
  }
  const legacy_path = path3.join(legacy_xdg_root(), relative_name);
  if (fs3.existsSync(legacy_path)) {
    return legacy_path;
  }
  return null;
}
function write_target(relative_name, options = {}) {
  if (is_absolute_like_python(relative_name)) {
    throw new Error(`write_target expects a relative path, got '${relative_name}'`);
  }
  return path3.join(event4u_root(options.env ?? null), relative_name);
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
    legacy_stat = fs3.statSync(legacy_root);
  } catch {
    return false;
  }
  if (!legacy_stat.isDirectory()) {
    return false;
  }
  const legacy_entries = fs3.readdirSync(legacy_root).filter((name) => name !== MIGRATION_BREADCRUMB_NAME);
  if (legacy_entries.length === 0) {
    return false;
  }
  const new_has_content = fs3.existsSync(new_root) && fs3.readdirSync(new_root).some((name) => !_is_partial_name(name));
  if (new_has_content) {
    _ensure_breadcrumb(legacy_root);
    return false;
  }
  fs3.mkdirSync(new_root, { recursive: true });
  _purge_partial_entries(new_root);
  for (const name of legacy_entries) {
    const entry = path3.join(legacy_root, name);
    const target = path3.join(new_root, name);
    if (fs3.existsSync(target)) {
      continue;
    }
    const staging = path3.join(new_root, `${name}${_PARTIAL_SUFFIX}${process.pid}`);
    if (fs3.existsSync(staging)) {
      _remove_path(staging);
    }
    if (fs3.statSync(entry).isDirectory()) {
      fs3.cpSync(entry, staging, { recursive: true, preserveTimestamps: true });
    } else {
      fs3.copyFileSync(entry, staging);
      const src_stat = fs3.statSync(entry);
      fs3.chmodSync(staging, src_stat.mode & 4095);
      fs3.utimesSync(staging, src_stat.atime, src_stat.mtime);
    }
    fs3.renameSync(staging, target);
  }
  _ensure_breadcrumb(legacy_root);
  return true;
}
function _is_partial_name(name) {
  return name.includes(_PARTIAL_SUFFIX);
}
function _purge_partial_entries(new_root) {
  for (const name of fs3.readdirSync(new_root)) {
    if (_is_partial_name(name)) {
      _remove_path(path3.join(new_root, name));
    }
  }
}
function _remove_path(p) {
  let st = null;
  try {
    st = fs3.lstatSync(p);
  } catch {
    return;
  }
  if (st.isDirectory() && !st.isSymbolicLink()) {
    fs3.rmSync(p, { recursive: true });
  } else {
    fs3.rmSync(p, { force: true });
  }
}
function _ensure_breadcrumb(legacy_root) {
  const breadcrumb = path3.join(legacy_root, MIGRATION_BREADCRUMB_NAME);
  if (fs3.existsSync(breadcrumb)) {
    return;
  }
  fs3.writeFileSync(breadcrumb, _BREADCRUMB_TEMPLATE, "utf-8");
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
    return path4.join(os2.homedir(), p.slice(2));
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
function read_lockfile(path39) {
  const target = path39 ?? lockfile_path();
  let text;
  try {
    text = fs4.readFileSync(target, { encoding: "utf-8" });
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
function _render(version2, tools, installed_at, fingerprint) {
  const lines = [
    `schema_version: ${SCHEMA_VERSION}`,
    `install_layout_version: ${INSTALL_LAYOUT_VERSION}`,
    `agent_config_version: "${version2}"`,
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
function write_lockfile(version2, tools, options = {}) {
  const target = options.path ?? lockfile_path();
  fs4.mkdirSync(path4.dirname(target), { recursive: true });
  const stamp = strftime_iso_z(options.now ?? /* @__PURE__ */ new Date());
  const rendered = _render(
    version2,
    sorted_unique(tools),
    stamp,
    options.host_layer_fingerprint ?? null
  );
  const parent = path4.dirname(target);
  const { fd, tmp_name } = mkstemp(parent, ".installed.lock.");
  try {
    fs4.writeFileSync(fd, rendered, { encoding: "utf-8" });
    fs4.closeSync(fd);
    fs4.renameSync(tmp_name, target);
  } catch (err) {
    try {
      fs4.closeSync(fd);
    } catch {
    }
    try {
      fs4.unlinkSync(tmp_name);
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
  const version2 = existing.agent_config_version || current_package_version();
  const tools = [...existing.tools ?? []];
  const when = options.now ?? _parse_installed_at(existing.installed_at);
  write_lockfile(version2, tools, {
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
    const tmp_name = path4.join(dir, `${prefix}${randomBytes(6).toString("hex")}`);
    try {
      const fd = fs4.openSync(tmp_name, "wx", 384);
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
function _parse_semver(version2) {
  const match = _SEMVER_RE.exec(version2);
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
    const data = JSON.parse(fs4.readFileSync(path4.join(dir, "package.json"), { encoding: "utf-8" }));
    const version2 = data.version;
    if (typeof version2 === "string" && version2.trim()) {
      return version2.trim();
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
    const parent = path4.dirname(dir);
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
  const here = path4.dirname(fileURLToPath(import.meta.url));
  return _find_package_version_upward(here) ?? "0.0.0";
}

// src/scripts/_lib/mcp_bridge.ts
import * as fs5 from "node:fs";
import * as path5 from "node:path";

// src/scripts/_lib/host_capability.ts
import process2 from "node:process";
var SAFE_DEFAULT = {
  schema_version: 1,
  subagent_spawn: false,
  parallel_spawn: false,
  status_polling: false,
  separate_quota_pool: false,
  agent_teams: false,
  worker_respawn: false,
  worker_resume: false,
  fork_shares_cache: false,
  structured_ask: false,
  reads_project_mcp_config: false,
  // `true` because the safe answer here is "there is still a step", not
  // "there is nothing to do" — see the field's own note.
  mcp_needs_manual_activation: true
};
function asBool(value) {
  return value === true;
}
function normalizeHostManifest(input) {
  if (input === null || typeof input !== "object") {
    return { ...SAFE_DEFAULT };
  }
  const src = input;
  return {
    schema_version: 1,
    subagent_spawn: asBool(src.subagent_spawn),
    parallel_spawn: asBool(src.parallel_spawn),
    status_polling: asBool(src.status_polling),
    separate_quota_pool: asBool(src.separate_quota_pool),
    agent_teams: asBool(src.agent_teams),
    worker_respawn: asBool(src.worker_respawn),
    worker_resume: asBool(src.worker_resume),
    fork_shares_cache: asBool(src.fork_shares_cache),
    structured_ask: asBool(src.structured_ask),
    reads_project_mcp_config: asBool(src.reads_project_mcp_config),
    // Inverted coercion, matching the inverted default: only an explicit
    // `false` clears the residual, so an absent or malformed value keeps
    // the manual step visible instead of silently dropping it.
    mcp_needs_manual_activation: src.mcp_needs_manual_activation !== false
  };
}
var HOST_CAPABILITY_REGISTRY = {
  claude: { subagent_spawn: true, parallel_spawn: true, structured_ask: true, fork_shares_cache: true }
};
function resolveHostCapabilities(hostId, override) {
  if (override !== void 0 && override !== null && typeof override === "object" && !Array.isArray(override)) {
    return normalizeHostManifest(override);
  }
  const row = hostId !== null && hostId !== void 0 ? HOST_CAPABILITY_REGISTRY[hostId] : void 0;
  if (row === void 0) {
    return { ...SAFE_DEFAULT };
  }
  return { ...SAFE_DEFAULT, ...row, schema_version: 1 };
}
function probeHostCapabilities(hostId) {
  const base = resolveHostCapabilities(hostId);
  const flag = process2.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
  const probedAgentTeams = typeof flag === "string" && flag !== "";
  const probedResume = probedAgentTeams && hostId === "claude";
  return { ...base, agent_teams: base.agent_teams || probedAgentTeams, worker_resume: base.worker_resume || probedResume };
}
var CAPABILITY_FIELDS = [
  "subagent_spawn",
  "parallel_spawn",
  "status_polling",
  "separate_quota_pool",
  "agent_teams",
  "worker_respawn",
  "worker_resume",
  "fork_shares_cache",
  "structured_ask",
  "reads_project_mcp_config",
  "mcp_needs_manual_activation"
];
function describeHostCapabilities(hostId) {
  const manifest = probeHostCapabilities(hostId);
  const row = hostId !== null && hostId !== void 0 ? HOST_CAPABILITY_REGISTRY[hostId] : void 0;
  const flag = process2.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
  const probedAgentTeams = typeof flag === "string" && flag !== "";
  const sources = {};
  for (const field of CAPABILITY_FIELDS) {
    if (row !== void 0 && typeof row[field] === "boolean" && !(row[field] === false && manifest[field] === true)) {
      sources[field] = "registry";
    } else if ((field === "agent_teams" || field === "worker_resume" && hostId === "claude") && probedAgentTeams) {
      sources[field] = "live-probe";
    } else {
      sources[field] = "default";
    }
  }
  return { manifest, sources };
}

// src/scripts/_lib/mcp_bridge.ts
var MCP_SERVER_KEY = "agent-config";
var MCP_PACKAGE_NAME = "@event4u/agent-config";
function mcpBridgeEntry(packageRoot) {
  const version2 = readPackageVersion(packageRoot);
  const args = version2 === null ? ["-y", MCP_PACKAGE_NAME, "mcp-server"] : ["--prefer-offline", "-y", `${MCP_PACKAGE_NAME}@${version2}`, "mcp-server"];
  return {
    mcpServers: {
      [MCP_SERVER_KEY]: {
        command: "npx",
        args
      }
    }
  };
}
function readPackageVersion(packageRoot) {
  try {
    const raw = fs5.readFileSync(path5.join(packageRoot, "package.json"), "utf-8");
    const v = JSON.parse(raw).version;
    return typeof v === "string" && v.trim() !== "" ? v : null;
  } catch {
    return null;
  }
}
function makeEnsureMcpBridge(mergeJsonFile) {
  return (projectRoot, force, packageRoot = projectRoot) => mergeJsonFile(
    path5.join(projectRoot, ".mcp.json"),
    mcpBridgeEntry(packageRoot),
    force,
    ".mcp.json"
  );
}
var MCP_PROJECT_CONFIG = {
  "claude-code": { hostId: "claude", relPath: ".mcp.json" },
  cursor: { hostId: "cursor", relPath: ".cursor/mcp.json" },
  "gemini-cli": { hostId: "gemini", relPath: ".gemini/settings.json" }
};
function mcpRegistrationTargets(tools, readsConfig) {
  const out = [];
  for (const [toolId, spec] of Object.entries(MCP_PROJECT_CONFIG)) {
    if (toolId === "claude-code") continue;
    if (!tools.has(toolId)) continue;
    if (!readsConfig(spec.hostId)) continue;
    out.push({ toolId, hostId: spec.hostId, relPath: spec.relPath });
  }
  return out;
}
function makeEnsureMcpRegistrations(mergeJsonFile) {
  return (projectRoot, force, packageRoot, targets) => {
    const merged = {};
    for (const t of targets) {
      merged[t.toolId] = mergeJsonFile(
        path5.join(projectRoot, ...t.relPath.split("/")),
        mcpBridgeEntry(packageRoot),
        force,
        t.relPath
      );
    }
    return merged;
  };
}
function readsProjectMcpConfig(hostId) {
  return probeHostCapabilities(hostId).reads_project_mcp_config;
}
function registerMcpHosts(mergeJsonFile, projectRoot, force, packageRoot, tools, into, readsConfig = readsProjectMcpConfig) {
  const ensure = makeEnsureMcpRegistrations(mergeJsonFile);
  const claude = MCP_PROJECT_CONFIG["claude-code"];
  if (tools.has("claude-code") && claude !== void 0) {
    const merged = ensure(projectRoot, force, packageRoot, [
      { toolId: "claude-code", hostId: claude.hostId, relPath: claude.relPath }
    ]);
    (into["claude-code"] ??= []).push(...merged["claude-code"] ?? []);
  }
  for (const [toolId, keys] of Object.entries(
    ensure(projectRoot, force, packageRoot, mcpRegistrationTargets(tools, readsConfig))
  )) {
    (into[toolId] ??= []).push(...keys);
  }
}
function projectionModeOf(raw) {
  return raw === "scoped" ? "scoped" : "legacy-all";
}
function resolveTierB(packageRoot) {
  const p = path5.join(packageRoot, "agents", "runtime", "state", "skill-tiers.json");
  if (!fs5.existsSync(p)) return null;
  try {
    const parsed = JSON.parse(fs5.readFileSync(p, "utf-8"));
    if (!Array.isArray(parsed.tier_b)) return null;
    return new Set(parsed.tier_b.filter((n) => typeof n === "string"));
  } catch {
    return null;
  }
}
function tierBAdvisory(packageRoot) {
  const tierB = resolveTierB(packageRoot);
  if (tierB === null || tierB.size === 0) return null;
  return `\u2139\uFE0F  ${tierB.size} skill(s) are predicted to reach the model WITHOUT their description on a default 200k window.
   Two levers, neither applied for you:
   \u2022 raise \`skillListingBudgetFraction\` in your Claude Code settings \u2014 restores descriptions at a token cost (100% delivery of this catalogue measures ~13,003 tok)
   \u2022 or reach them through the MCP server, which serves every skill by name regardless of what the host catalogue carries (docs/mcp-server.md)`;
}

// src/scripts/_lib/mcp_consent_residual.ts
var SEEDED = {
  claude: {
    hostId: "claude",
    residual: "Approve the project-scoped `agent-config` server the first time the host prompts \u2014 the installer writes `.mcp.json` but does not pre-approve it.",
    source: "vendor-doc",
    cite: "Host documentation: a project-scope MCP server requires explicit approval, suppressible only through the user-global `enabledMcpjsonServers` key, which this package deliberately does not write (blocker `mcp-user-scope-approval-consent`)."
  }
};
var TOOL_TO_HOST = {
  "claude-code": "claude",
  cursor: "cursor",
  "gemini-cli": "gemini",
  windsurf: "windsurf",
  cline: "cline",
  copilot: "copilot",
  augment: "augment"
};
function residualFor(hostId) {
  const { manifest, sources } = describeHostCapabilities(hostId);
  if (sources.mcp_needs_manual_activation === "registry" && !manifest.mcp_needs_manual_activation) {
    return null;
  }
  return SEEDED[hostId] ?? null;
}
function isRecorded(hostId) {
  const { sources } = describeHostCapabilities(hostId);
  return hostId in SEEDED || sources.mcp_needs_manual_activation === "registry";
}
function residualLine(hostId) {
  const r = residualFor(hostId);
  if (r !== null) {
    return {
      hostId,
      state: "residual",
      text: `${hostId}: ${r.residual} (source: ${r.source} \u2014 not observed here)`
    };
  }
  if (isRecorded(hostId)) {
    return {
      hostId,
      state: "cleared",
      text: `${hostId}: nothing left to do (source: observed)`
    };
  }
  return {
    hostId,
    state: "unrecorded",
    text: `${hostId}: no residual recorded \u2014 nobody checked this host, which is not the same as nothing to do`
  };
}
function residualReport(toolIds) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const toolId of toolIds) {
    const hostId = TOOL_TO_HOST[toolId];
    if (hostId === void 0 || seen.has(hostId)) continue;
    seen.add(hostId);
    const line = residualLine(hostId);
    if (line.state !== "cleared") out.push(line);
  }
  return out;
}
function printResiduals(toolIds, quiet, write = (s) => process.stdout.write(s)) {
  if (quiet) return;
  const lines = residualReport(toolIds);
  if (lines.length === 0) return;
  write("  Still needs you (MCP):\n");
  for (const line of lines) write(`    \u2022 ${line.text}
`);
  write("\n");
}

// src/scripts/_lib/scoped_projection.ts
import * as fs7 from "node:fs";
import { createRequire } from "node:module";
import * as path7 from "node:path";

// src/scripts/_lib/surface_tiers.ts
import * as fs6 from "node:fs";
import * as path6 from "node:path";
var _LAB_FALLBACK = /* @__PURE__ */ new Set(["ai-video", "ai-image", "fun"]);
function load_lab_pack_ids(repo_root) {
  const vocab = path6.join(repo_root, "src", "config", "discovery", "packs.yml");
  const ids = /* @__PURE__ */ new Set();
  try {
    const YAML6 = require_dist();
    const data = YAML6.parse(fs6.readFileSync(vocab, "utf-8"), { version: "1.1" });
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
    text = fs6.readFileSync(md_path, "utf-8");
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
var MAINTAINER_WORKSPACE = "agent-config-maintainer";
function consumerRuleWorkspaces(packageRoot) {
  const ids = /* @__PURE__ */ new Set();
  let records;
  try {
    records = load_packs_registry(packageRoot);
  } catch {
    return [];
  }
  for (const rec of records) {
    for (const ws of rec.workspaces) if (ws !== MAINTAINER_WORKSPACE) ids.add(ws);
  }
  return [...ids].sort();
}
function isPlainObject2(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function yamlSafeLoad(text) {
  let YAML6;
  try {
    YAML6 = _require("yaml");
  } catch {
    return null;
  }
  try {
    return YAML6.parse(text, { version: "1.1" }) ?? null;
  } catch {
    return null;
  }
}
var PACKS_YML_REL = path7.join("src", "config", "discovery", "packs.yml");
function load_packs_registry(package_root) {
  const vocab_path = path7.join(package_root, PACKS_YML_REL);
  const data = yamlSafeLoad(fs7.readFileSync(vocab_path, "utf-8"));
  if (!Array.isArray(data)) {
    throw new Error(`packs.yml did not parse to a list: ${vocab_path}`);
  }
  const out = [];
  for (const entry of data) {
    if (!isPlainObject2(entry)) continue;
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
function is_pruned_under_scoped(md_path, active_ids, kept = /* @__PURE__ */ new Set()) {
  if (path7.basename(md_path) === "SKILL.md" && kept.has(path7.basename(path7.dirname(md_path)))) {
    return false;
  }
  const packs = frontmatter_packs(md_path);
  if (packs.size === 0) return false;
  for (const id of packs) {
    if (active_ids.has(id)) return false;
  }
  return true;
}
function declared_skills(md_path) {
  let text;
  try {
    text = fs7.readFileSync(md_path, "utf-8");
  } catch {
    return [];
  }
  if (!text.startsWith("---")) return [];
  const end = text.indexOf("\n---", 3);
  const fm = yamlSafeLoad(end !== -1 ? text.slice(3, end) : text.slice(3));
  if (!isPlainObject2(fm)) return [];
  const out = [];
  for (const key of ["skills", "requires_skills"]) {
    const v = fm[key];
    if (Array.isArray(v)) out.push(...v.filter((s) => typeof s === "string"));
  }
  return out;
}
function declared_skill_closure(artefacts, active_ids) {
  const all = [...artefacts];
  const skill_md = /* @__PURE__ */ new Map();
  for (const p of all) {
    if (path7.basename(p) === "SKILL.md") skill_md.set(path7.basename(path7.dirname(p)), p);
  }
  const kept = /* @__PURE__ */ new Set();
  let frontier = all.filter((p) => !is_pruned_under_scoped(p, active_ids));
  while (frontier.length > 0) {
    const next = [];
    for (const p of frontier) {
      for (const name of declared_skills(p)) {
        if (kept.has(name)) continue;
        kept.add(name);
        const target = skill_md.get(name);
        if (target !== void 0 && is_pruned_under_scoped(target, active_ids)) next.push(target);
      }
    }
    frontier = next;
  }
  return kept;
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
function prune_modules_by(deploy_results, is_pruned) {
  let pruned = 0;
  const adjusted = {};
  for (const tool_id of Object.keys(deploy_results)) {
    const [written, skipped, status, paths] = deploy_results[tool_id];
    const pruned_skill_dirs = /* @__PURE__ */ new Set();
    for (const p of paths) {
      const parts = p.split(path7.sep);
      if (parts.includes("skills")) {
        const i = parts.indexOf("skills");
        if (i + 1 < parts.length) {
          const skill_root = parts.slice(0, i + 2).join(path7.sep);
          if (!pruned_skill_dirs.has(skill_root)) {
            const skillmd = path7.join(skill_root, "SKILL.md");
            if (fs7.existsSync(skillmd) && is_pruned(skillmd)) {
              pruned_skill_dirs.add(skill_root);
            }
          }
        }
      }
    }
    const keep = [];
    const delete_files = [];
    for (const p of paths) {
      const parts = p.split(path7.sep);
      let is_target = false;
      if (parts.includes("skills")) {
        const i = parts.indexOf("skills");
        if (i + 1 < parts.length && pruned_skill_dirs.has(parts.slice(0, i + 2).join(path7.sep))) {
          is_target = true;
        }
      } else if (parts.includes("commands") && path7.extname(p) === ".md" && is_pruned(p)) {
        is_target = true;
      }
      (is_target ? delete_files : keep).push(p);
    }
    for (const d of pruned_skill_dirs) {
      fs7.rmSync(d, { recursive: true, force: true });
    }
    for (const p of delete_files) {
      if (p.split(path7.sep).includes("commands") && fs7.existsSync(p)) {
        try {
          fs7.unlinkSync(p);
        } catch {
        }
      }
    }
    pruned += delete_files.length;
    adjusted[tool_id] = [Math.max(0, written - delete_files.length), skipped, status, keep];
  }
  return [pruned, adjusted];
}
function prune_scoped_modules(deploy_results, active_ids) {
  const artefacts = Object.values(deploy_results).flatMap(([, , , paths]) => paths).filter((p) => path7.basename(p) === "SKILL.md" || p.split(path7.sep).includes("commands") && path7.extname(p) === ".md");
  const kept = declared_skill_closure(artefacts, active_ids);
  return prune_modules_by(deploy_results, (p) => is_pruned_under_scoped(p, active_ids, kept));
}
function prune_lab_modules(deploy_results, lab_ids) {
  return prune_modules_by(deploy_results, (p) => is_lab_artefact(p, lab_ids));
}

// src/install/conflictTracker.ts
import * as crypto2 from "node:crypto";
import * as fs12 from "node:fs";
import * as os5 from "node:os";
import * as path11 from "node:path";

// src/install/fsPrimitives.ts
import * as crypto from "node:crypto";
import * as fs8 from "node:fs";
import * as path8 from "node:path";
function resolvePath(p) {
  try {
    return fs8.realpathSync(path8.resolve(p));
  } catch {
    return path8.resolve(p);
  }
}
function pathExists(p) {
  try {
    fs8.statSync(p);
    return true;
  } catch {
    return false;
  }
}
function mkdirp(p) {
  fs8.mkdirSync(p, { recursive: true });
}
function sha256OfFile(p) {
  let data;
  try {
    data = fs8.readFileSync(p);
  } catch {
    return null;
  }
  return crypto.createHash("sha256").update(data).digest("hex");
}

// src/install/recordedOwnership.ts
var YAML2 = __toESM(require_dist(), 1);
import { existsSync as existsSync4, readFileSync as readFileSync9 } from "node:fs";
import { homedir as homedir5 } from "node:os";
import { isAbsolute as isAbsolute2, join as join10, resolve as resolve3 } from "node:path";

// src/scripts/_lib/global_deploy_inventory.ts
import { createHash as createHash3, randomBytes as randomBytes2 } from "node:crypto";
import * as fs9 from "node:fs";
import * as os3 from "node:os";
import * as path9 from "node:path";
var SCHEMA_VERSION2 = 2;
var INVENTORY_BASENAME = "deployed-files.json";
var INVENTORY_ENV = "AGENT_CONFIG_DEPLOY_INVENTORY";
function expanduser3(p) {
  if (p === "~") {
    return os3.homedir();
  }
  if (p.startsWith("~/") || process.platform === "win32" && p.startsWith("~\\")) {
    return path9.join(os3.homedir(), p.slice(2));
  }
  return p;
}
function expanduser_at(p, home) {
  if (home === void 0 || home === null || home === "") return expanduser3(p);
  if (p === "~") return home;
  if (p.startsWith("~/") || process.platform === "win32" && p.startsWith("~\\")) {
    return path9.join(home, p.slice(2));
  }
  return p;
}
function resolve_path(p) {
  try {
    return fs9.realpathSync(p);
  } catch {
    const abs = path9.resolve(p);
    const parts = abs.split(path9.sep);
    for (let i = parts.length; i > 0; i -= 1) {
      const prefix = parts.slice(0, i).join(path9.sep) || path9.sep;
      try {
        const real = fs9.realpathSync(prefix);
        const rest = parts.slice(i);
        return rest.length > 0 ? path9.join(real, ...rest) : real;
      } catch {
        continue;
      }
    }
    return abs;
  }
}
function path_exists(p) {
  try {
    fs9.statSync(p);
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
    data = JSON.parse(fs9.readFileSync(target, { encoding: "utf-8" }));
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
  fs9.mkdirSync(path9.dirname(target), { recursive: true });
  const payload = json_dumps_sorted(data, 2) + "\n";
  const parent = path9.dirname(target);
  let fd = null;
  let tmp_name = "";
  for (let attempt = 0; attempt < 32; attempt += 1) {
    tmp_name = path9.join(parent, `${path9.basename(target)}.${randomBytes2(6).toString("hex")}`);
    try {
      fd = fs9.openSync(tmp_name, "wx", 384);
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
    fs9.writeFileSync(fd, payload, { encoding: "utf-8" });
    fs9.closeSync(fd);
    fs9.renameSync(tmp_name, target);
  } catch (err) {
    try {
      fs9.closeSync(fd);
    } catch {
    }
    try {
      fs9.unlinkSync(tmp_name);
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
    src_stat = fs9.statSync(src);
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
  const _walk = (node2, prefix) => {
    const entries = fs9.readdirSync(node2).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
    for (const name of entries) {
      const entry = path9.join(node2, name);
      const rel = join_rel(prefix, name);
      const lst = fs9.lstatSync(entry);
      if (lst.isDirectory() && !lst.isSymbolicLink()) {
        _walk(entry, rel);
        continue;
      }
      let resolved_is_dir = false;
      try {
        resolved_is_dir = fs9.statSync(entry).isDirectory();
      } catch {
        resolved_is_dir = false;
      }
      if (resolved_is_dir) {
        _walk(fs9.realpathSync(entry), rel);
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
  return prefix ? path9.join(prefix, name) : name;
}
function as_posix(p) {
  if (p === "") {
    return ".";
  }
  return p.split(path9.sep).join("/");
}
function reap_stale(tool_id, anchor2, current_files, inventory, dry_run = false, retained = null) {
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
  const anchor_resolved = resolve_path(expanduser3(anchor2));
  if (resolve_path(expanduser3(recorded_anchor)) !== anchor_resolved) {
    return [];
  }
  const deleted = [];
  const prune_candidates = /* @__PURE__ */ new Set();
  const digests = digests_of_entry(e);
  const recorded = [...digests].filter(([, d]) => !(dry_run && d.kind === "sidecar")).map(([rel]) => rel);
  const orphans = difference([...prev_files, ...recorded], current_files);
  for (const rel of sorted_strings(orphans)) {
    if (typeof rel !== "string" || !rel || rel.startsWith("/") || rel.startsWith("..")) {
      continue;
    }
    const target = path9.join(anchor_resolved, rel);
    try {
      relative_to(resolve_path(path9.dirname(target)), anchor_resolved);
    } catch {
      continue;
    }
    let lst = null;
    try {
      lst = fs9.lstatSync(target);
    } catch {
      lst = null;
    }
    if (lst && lst.isDirectory() && !lst.isSymbolicLink()) {
      continue;
    }
    if (lst !== null && edited_since_install(target, digests.get(rel))) {
      retained?.push(target);
      continue;
    }
    if (dry_run) {
      if (path_exists(target) || lst !== null && lst.isSymbolicLink()) {
        deleted.push(target);
      }
      continue;
    }
    try {
      fs9.unlinkSync(target);
    } catch {
      continue;
    }
    deleted.push(target);
    prune_candidates.add(path9.dirname(target));
  }
  prune_empty_dirs(prune_candidates, anchor_resolved);
  return deleted;
}
function reap_tagged_orphans(anchor2, dest_subs, current_files, package_tag, dry_run = false, digests = /* @__PURE__ */ new Map(), retained = null) {
  const anchor_resolved = resolve_path(expanduser3(anchor2));
  const deleted = [];
  const prune_candidates = /* @__PURE__ */ new Set();
  const needle = `package: ${package_tag}`;
  for (const dest_sub of dest_subs) {
    const root = dest_sub ? path9.join(anchor_resolved, dest_sub) : anchor_resolved;
    let root_stat;
    try {
      root_stat = fs9.statSync(root);
    } catch {
      continue;
    }
    if (!root_stat.isDirectory()) {
      continue;
    }
    for (const md of rglob_md(root)) {
      let md_lst;
      try {
        md_lst = fs9.lstatSync(md);
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
        relative_to(resolve_path(path9.dirname(md)), anchor_resolved);
      } catch {
        continue;
      }
      let head;
      try {
        head = fs9.readFileSync(md, { encoding: "utf-8" });
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
      if (edited_since_install(md, digests.get(rel))) {
        retained?.push(md);
        continue;
      }
      if (dry_run) {
        deleted.push(md);
        continue;
      }
      try {
        fs9.unlinkSync(md);
      } catch {
        continue;
      }
      deleted.push(md);
      prune_candidates.add(path9.dirname(md));
    }
  }
  prune_empty_dirs(prune_candidates, anchor_resolved);
  return deleted;
}
function record_deploy(tool_id, anchor2, current_files, inventory, digests = null) {
  if (typeof inventory["tools"] !== "object" || inventory["tools"] === null || Array.isArray(inventory["tools"])) {
    inventory["tools"] = {};
  }
  const tools = inventory["tools"];
  const record = {
    anchor: String(anchor2),
    files: sorted_strings([...current_files])
  };
  if (digests !== null && digests.size > 0) {
    record["digests"] = Object.fromEntries(
      sorted_strings([...digests.keys()]).map((rel) => [rel, { ...digests.get(rel) }])
    );
  }
  tools[tool_id] = record;
  inventory["schema_version"] = SCHEMA_VERSION2;
  return inventory;
}
function file_sha256(p) {
  try {
    return createHash3("sha256").update(fs9.readFileSync(p)).digest("hex");
  } catch {
    return null;
  }
}
function edited_since_install(target, rec) {
  if (rec === void 0) return false;
  const on_disk = file_sha256(target);
  if (on_disk !== null) return on_disk !== rec.installed_sha256;
  try {
    return !fs9.lstatSync(target).isSymbolicLink();
  } catch {
    return false;
  }
}
function digests_of_entry(e) {
  const out = /* @__PURE__ */ new Map();
  const raw = e["digests"];
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return out;
  for (const [rel, rec] of Object.entries(raw)) {
    if (typeof rec !== "object" || rec === null || Array.isArray(rec)) continue;
    const r = rec;
    const installed = r["installed_sha256"];
    const packaged = r["packaged_sha256"];
    if (typeof installed !== "string" || installed === "") continue;
    out.set(rel, {
      installed_sha256: installed,
      packaged_sha256: typeof packaged === "string" && packaged !== "" ? packaged : null,
      ...r["kind"] === "sidecar" ? { kind: "sidecar" } : {}
    });
  }
  return out;
}
function recorded_digests(tool_id, anchor2, inventory) {
  const inv = inventory ?? load_inventory();
  const tools = inv["tools"] ?? {};
  const entry = tools[tool_id];
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return /* @__PURE__ */ new Map();
  const e = entry;
  const recorded_anchor = e["anchor"];
  if (typeof recorded_anchor !== "string") return /* @__PURE__ */ new Map();
  if (resolve_path(expanduser3(recorded_anchor)) !== resolve_path(expanduser3(anchor2))) {
    return /* @__PURE__ */ new Map();
  }
  return digests_of_entry(e);
}
function recorded_absolute_digests(inventory, home) {
  const inv = inventory ?? load_inventory();
  const tools = inv["tools"] ?? {};
  const out = /* @__PURE__ */ new Map();
  if (typeof tools !== "object" || tools === null || Array.isArray(tools)) return out;
  for (const entry of Object.values(tools)) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
    const e = entry;
    const anchor2 = e["anchor"];
    if (typeof anchor2 !== "string") continue;
    const expanded = expanduser_at(anchor2, home);
    for (const [rel, rec] of digests_of_entry(e)) {
      const lexical = path9.resolve(expanded, rel);
      out.set(lexical, rec.installed_sha256);
      out.set(resolve_path(lexical), rec.installed_sha256);
    }
  }
  return out;
}
function prune_empty_dirs(prune_candidates, anchor_resolved) {
  const ordered = [...prune_candidates].sort(
    (a, b) => b.split(path9.sep).length - a.split(path9.sep).length
  );
  for (const start of ordered) {
    let node2 = start;
    while (node2 !== anchor_resolved && is_ancestor(anchor_resolved, node2)) {
      try {
        fs9.rmdirSync(node2);
      } catch {
        break;
      }
      node2 = path9.dirname(node2);
    }
  }
}
function is_ancestor(anchor2, node2) {
  const rel = path9.relative(anchor2, node2);
  return rel !== "" && !rel.startsWith("..") && !path9.isAbsolute(rel);
}
function relative_to(child, parent) {
  if (child === parent) {
    return "";
  }
  const rel = path9.relative(parent, child);
  if (rel.startsWith("..") || path9.isAbsolute(rel)) {
    throw new Error(`'${child}' is not in the subpath of '${parent}'`);
  }
  return rel;
}
function relative_to_posix(child, parent) {
  return path9.relative(parent, child).split(path9.sep).join("/");
}
function rglob_md(root) {
  const out = [];
  const walk = (dir) => {
    let names;
    try {
      names = fs9.readdirSync(dir).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
    } catch {
      return;
    }
    for (const name of names) {
      const full = path9.join(dir, name);
      let lst;
      try {
        lst = fs9.lstatSync(full);
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
function recorded_rel_files(tool_id, anchor2, inventory) {
  const inv = inventory ?? load_inventory();
  const tools = inv["tools"] ?? {};
  const entry = tools[tool_id];
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    return /* @__PURE__ */ new Set();
  }
  const e = entry;
  const recorded_anchor = e["anchor"];
  const files = e["files"];
  if (typeof recorded_anchor !== "string" || !Array.isArray(files)) {
    return /* @__PURE__ */ new Set();
  }
  if (resolve_path(expanduser3(recorded_anchor)) !== resolve_path(expanduser3(anchor2))) {
    return /* @__PURE__ */ new Set();
  }
  return new Set(files.filter((f) => typeof f === "string"));
}
function recorded_absolute_files(inventory, home) {
  const inv = inventory ?? load_inventory();
  const tools = inv["tools"] ?? {};
  const out = /* @__PURE__ */ new Set();
  if (typeof tools !== "object" || tools === null || Array.isArray(tools)) return out;
  for (const entry of Object.values(tools)) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
    const e = entry;
    const anchor2 = e["anchor"];
    const files = e["files"];
    if (typeof anchor2 !== "string" || !Array.isArray(files)) continue;
    const expanded = expanduser_at(anchor2, home);
    for (const rel of files) {
      if (typeof rel !== "string") continue;
      const lexical = path9.resolve(expanded, rel);
      out.add(lexical);
      out.add(resolve_path(lexical));
    }
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

// src/scripts/_lib/installed_tools.ts
import * as fs11 from "node:fs";
import * as os4 from "node:os";
import * as fsPath from "node:path";

// src/scripts/_lib/fs_atomic.ts
import fs10 from "node:fs";
import path10 from "node:path";
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
  const target = path10.normalize(p);
  const parent = path10.dirname(target);
  fs10.mkdirSync(parent, { recursive: true });
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
    tmp_path = path10.join(
      parent,
      `.${path10.basename(target)}.tmp.${randomBytes3(6).toString("hex")}`
    );
    try {
      fd = fs10.openSync(tmp_path, "wx", 384);
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
      offset += fs10.writeSync(fd, payload, offset, payload.length - offset);
    }
    try {
      fs10.fsyncSync(fd);
    } catch {
    }
    fs10.closeSync(fd);
    closed = true;
    fs10.renameSync(tmp_path, target);
  } catch (err) {
    if (!closed) {
      try {
        fs10.closeSync(fd);
      } catch {
      }
    }
    try {
      fs10.unlinkSync(tmp_path);
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
    dir_fd = fs10.openSync(directory, fs10.constants.O_RDONLY);
  } catch {
    return;
  }
  try {
    try {
      fs10.fsyncSync(dir_fd);
    } catch {
    }
  } finally {
    fs10.closeSync(dir_fd);
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
function read_manifest(path39) {
  let text;
  try {
    text = require_read_text(path39);
  } catch {
    return null;
  }
  const data = _parse_manual(text);
  return _normalise_v2_shape(data);
}
function require_read_text(path39) {
  return fs11.readFileSync(path39, { encoding: "utf-8" });
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
function _render2(version2, tools, options = {}) {
  const deploy_roots = options.deploy_roots ?? null;
  const lines = [
    `schema_version: ${SCHEMA_VERSION3}`,
    `agent_config_version: "${version2}"`
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
function write_manifest(path39, version2, tools, options = {}) {
  const rendered = _render2(version2, tools, { deploy_roots: options.deploy_roots ?? null });
  return write_atomic(path39, rendered);
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

// src/install/recordedOwnership.ts
var NO_RECORDED_HASHES = /* @__PURE__ */ new Map();
function classifyFileState(installedSha256, packagedSha256, onDiskSha256) {
  if (installedSha256 === void 0 || installedSha256 === null) return "unknown";
  if (onDiskSha256 === null) return "unknown";
  const untouched = onDiskSha256 === installedSha256;
  if (packagedSha256 === null) return untouched ? "retired-unmodified" : "retired-modified";
  if (packagedSha256 !== void 0 && onDiskSha256 === packagedSha256) return "clean";
  const shipsWhatWeWrote = packagedSha256 === void 0 || packagedSha256 === installedSha256;
  if (untouched) return shipsWhatWeWrote ? "clean" : "outdated";
  return shipsWhatWeWrote ? "customized" : "customized-and-outdated";
}
function ownershipOfState(state2) {
  switch (state2) {
    case "clean":
    case "outdated":
    case "retired-unmodified":
      return "recorded-unchanged";
    case "customized":
    case "customized-and-outdated":
    case "retired-modified":
      return "recorded-modified";
    case "unknown":
      return "unknown";
  }
}
function classifyOwnership(recordedSha256, onDiskSha256) {
  return ownershipOfState(classifyFileState(recordedSha256, void 0, onDiskSha256));
}
function readRecordedHashes(manifestPath, projectRoot) {
  if (!existsSync4(manifestPath)) return NO_RECORDED_HASHES;
  let doc;
  try {
    doc = YAML2.parse(readFileSync9(manifestPath, "utf8"));
  } catch {
    return NO_RECORDED_HASHES;
  }
  if (doc === null || typeof doc !== "object" || Array.isArray(doc)) return NO_RECORDED_HASHES;
  const tools = doc["tools"];
  if (!Array.isArray(tools)) return NO_RECORDED_HASHES;
  const out = /* @__PURE__ */ new Map();
  for (const tool of tools) {
    if (tool === null || typeof tool !== "object" || Array.isArray(tool)) continue;
    const files = tool["files"];
    if (!Array.isArray(files)) continue;
    for (const entry of files) {
      if (entry === null || typeof entry !== "object" || Array.isArray(entry)) continue;
      const rec = entry;
      const raw = rec["path"];
      if (typeof raw !== "string" || raw.length === 0) continue;
      const sha = rec["sha256"];
      const expanded = expanduser5(raw);
      const target = isAbsolute2(expanded) ? resolve3(expanded) : resolve3(projectRoot, expanded);
      out.set(target, typeof sha === "string" && sha.length > 0 ? sha : null);
    }
  }
  return out;
}
function expanduser5(p) {
  if (p === "~") return homedir5();
  if (p.startsWith("~/") || process.platform === "win32" && p.startsWith("~\\")) {
    return join10(homedir5(), p.slice(2));
  }
  return p;
}
function recordedHashesForRoot(root, env) {
  return readRecordedHashes(manifest_path(root, env), root);
}
function ledgerListedPaths(env) {
  return recorded_absolute_files(
    load_inventory(inventory_path(env)),
    env?.["HOME"]
  );
}
function recordedHashesWithLedger(root, env) {
  const out = new Map(recordedHashesForRoot(root, env));
  const ledger = load_inventory(inventory_path(env));
  for (const [target, sha] of recorded_absolute_digests(ledger, env?.["HOME"])) {
    out.set(target, sha);
  }
  return out;
}

// src/install/preserve.ts
var SIDECAR_SUFFIX = ".agent-config.new";
var EXIT_COMPLETED_WITH_CONFLICTS = 3;
function isLedgerMigration(inputs) {
  if (!inputs.exists || inputs.force || inputs.loggedWrite === true) return false;
  if (inputs.ledgerListed !== true) return false;
  if (inputs.onDiskSha256 === null) return false;
  return classifyOwnership(inputs.recordedSha256, inputs.onDiskSha256) === "unknown";
}
function logProofApplies(inputs) {
  if (!inputs.exists || inputs.force || inputs.onDiskSha256 === null) return false;
  const ownership = classifyOwnership(inputs.recordedSha256, inputs.onDiskSha256);
  if (ownership === "recorded-modified") return inputs.recordedIsStaged === true;
  return ownership === "unknown" && isLedgerMigration({ ...inputs, loggedWrite: false });
}
function decideDeployWrite(inputs) {
  if (!inputs.exists) return "write";
  if (inputs.force) return "write";
  if (inputs.loggedWrite === true && logProofApplies(inputs)) return "write";
  const ownership = classifyOwnership(inputs.recordedSha256, inputs.onDiskSha256);
  if (ownership === "recorded-modified") return "preserve";
  if (ownership === "unknown" && isLedgerMigration(inputs)) {
    return inputs.packagedSha256 != null && inputs.packagedSha256 === inputs.onDiskSha256 ? "write" : "preserve";
  }
  return "write";
}
function sidecarPathFor(target) {
  return `${target}${SIDECAR_SUFFIX}`;
}
function preservedFileMessage(target, sidecar) {
  return `Preserved user-modified ${target}. Package content was written to ${sidecar}; the active installation is not current. Review and merge it, or rerun with --force to replace the managed file.`;
}
function migrationPreservedMessage(target, sidecar) {
  return `Preserved ${target} without being able to classify it: this package deployed it before it began recording digests, so an edit and an older version look the same here. Package content was written to ${sidecar}; the active installation is not current. Review and merge it, or rerun with --force to replace the managed file. Once resolved, this file is classified normally on every later install.`;
}
function conflictSummaryMessage(count) {
  const noun = count === 1 ? "file" : "files";
  return `Completed with conflicts: ${count} user-modified ${noun} preserved. Package content is staged alongside as *${SIDECAR_SUFFIX}; the active installation is not current until you merge it, or rerun with --force to replace the managed ${noun}.`;
}
function foreignSidecarMessage(target, sidecar) {
  return `Refusing to replace ${sidecar}: it already exists with different content and this install cannot show it wrote it. Package content for ${target} was NOT staged. Move or delete that file and re-run, or rerun with --force to replace the managed file instead.`;
}

// src/install/loggedWrites.ts
import { gunzipSync } from "node:zlib";
import { existsSync as existsSync5, readdirSync as readdirSync5, readFileSync as readFileSync10, realpathSync as realpathSync3, statSync as statSync4 } from "node:fs";
import { basename as basename3, dirname as dirname4, join as join12, relative as relative2, resolve as resolve4, sep as sep3 } from "node:path";

// src/install/paths.ts
import { homedir as homedir6, tmpdir } from "node:os";
import { join as join11 } from "node:path";
var INSTALL_ROOT_SUBPATH = ".event4u/agent-config";
var INSTALL_LOG_FILENAME = "install-log.jsonl";
function resolveHome(home) {
  if (home && home.length > 0) {
    return home;
  }
  const fromOs = homedir6();
  if (!fromOs) {
    throw new Error(
      "Cannot resolve home directory \u2014 both $HOME (POSIX) and $USERPROFILE (Windows) are unset."
    );
  }
  return fromOs;
}
function getInstallRoot(home) {
  return join11(resolveHome(home), INSTALL_ROOT_SUBPATH);
}
function getLogPath(home) {
  const configHome = home ? void 0 : process.env["EVENT4U_CONFIG_HOME"];
  if (configHome) return join11(configHome, INSTALL_LOG_FILENAME);
  return join11(getInstallRoot(home), INSTALL_LOG_FILENAME);
}

// src/install/loggedWrites.ts
var WRITE_MARKER = '"kind":"write"';
var fileCache = /* @__PURE__ */ new Map();
var dirRealpaths = /* @__PURE__ */ new Map();
function canonicalPath(p) {
  const abs = resolve4(p);
  const dir = dirname4(abs);
  let real = dirRealpaths.get(dir);
  if (real === void 0) {
    try {
      real = realpathSync3(dir);
    } catch {
      real = dir;
    }
    dirRealpaths.set(dir, real);
  }
  return join12(real, basename3(abs));
}
function logFiles(logPath) {
  const dir = dirname4(logPath);
  if (!existsSync5(dir)) return [];
  const stem = basename3(logPath).replace(/\.jsonl$/, "");
  try {
    return readdirSync5(dir).filter((n) => n.startsWith(stem) && (n.endsWith(".jsonl") || n.endsWith(".jsonl.gz"))).map((n) => join12(dir, n)).sort();
  } catch {
    return [];
  }
}
function writesIn(file) {
  let stamp;
  try {
    const st = statSync4(file);
    stamp = `${st.size}:${Math.trunc(st.mtimeMs)}`;
  } catch {
    return [];
  }
  const cached2 = fileCache.get(file);
  if (cached2 !== void 0 && cached2.stamp === stamp) return cached2.entries;
  let text = "";
  try {
    const raw = readFileSync10(file);
    text = (file.endsWith(".gz") ? gunzipSync(raw) : raw).toString("utf8");
  } catch {
    text = "";
  }
  const entries = [];
  for (const line of text.split("\n")) {
    if (!line.includes(WRITE_MARKER)) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof entry.path !== "string" || typeof entry.sha256 !== "string" || entry.sha256 === "") continue;
    entries.push([canonicalPath(entry.path), entry.sha256]);
  }
  fileCache.set(file, { stamp, entries });
  return entries;
}
function loggedWriteDigests(logPath = getLogPath()) {
  const writes = /* @__PURE__ */ new Map();
  for (const file of logFiles(logPath)) {
    for (const [target, sha] of writesIn(file)) {
      let set = writes.get(target);
      if (set === void 0) writes.set(target, set = /* @__PURE__ */ new Set());
      set.add(sha);
    }
  }
  return writes;
}
function onlyDeployed(anchor2, currentFiles, log) {
  return (target) => {
    const rel = relative2(resolve4(anchor2), resolve4(target)).split(sep3).join("/");
    if (currentFiles.has(rel)) log(target);
  };
}
function wroteTheseBytes(target, onDiskSha256, writes) {
  return writes.get(canonicalPath(target))?.has(onDiskSha256) === true;
}

// src/install/conflictTracker.ts
function createConflictTracker(host) {
  const conflictState = {
    root: null,
    recorded: null,
    ledgerFiles: null,
    logged: null,
    preserved: [],
    migrated: /* @__PURE__ */ new Set(),
    staged: /* @__PURE__ */ new Map()
  };
  function recordedHashFor(target) {
    if (conflictState.root === null) return void 0;
    conflictState.recorded ??= recordedHashesWithLedger(conflictState.root);
    const plain = path11.resolve(target);
    if (conflictState.recorded.has(plain)) return conflictState.recorded.get(plain);
    const real = resolvePath(target);
    return real === plain ? void 0 : conflictState.recorded.get(real);
  }
  function ledgerLists(target) {
    conflictState.ledgerFiles ??= ledgerListedPaths();
    const files = conflictState.ledgerFiles;
    return files.has(path11.resolve(target)) || files.has(resolvePath(target));
  }
  function wouldWriteDigest(target, would) {
    const tmp = path11.join(
      os5.tmpdir(),
      `agent-config-would.${process.pid}.${crypto2.randomBytes(6).toString("hex")}${path11.extname(target)}`
    );
    try {
      if ("content" in would) {
        fs12.writeFileSync(tmp, would.content, "utf-8");
      } else {
        fs12.copyFileSync(would.from, tmp);
        host.tagDeployed(tmp, would.from, would.packageRoot);
      }
      return sha256OfFile(tmp);
    } catch {
      return null;
    } finally {
      try {
        fs12.unlinkSync(tmp);
      } catch {
      }
    }
  }
  function stageInto(target, sidecar, produce) {
    mkdirp(path11.dirname(sidecar));
    const tmp = path11.join(
      path11.dirname(sidecar),
      `.${path11.basename(sidecar)}.${process.pid}.${crypto2.randomBytes(6).toString("hex")}${path11.extname(target)}`
    );
    const discard = () => {
      try {
        fs12.unlinkSync(tmp);
      } catch {
      }
    };
    let candidate;
    try {
      produce(tmp);
      candidate = sha256OfFile(tmp);
    } catch (exc) {
      discard();
      host.fail(
        `Could not stage package content for ${target} at ${sidecar}: ${String(exc)}. Nothing was written; the managed file is unchanged.`
      );
    }
    if (pathExists(sidecar)) {
      const onDisk = sha256OfFile(sidecar);
      if (onDisk !== null && onDisk === candidate) {
        discard();
        conflictState.staged.set(sidecar, onDisk);
        return;
      }
      if (onDisk === null || onDisk !== recordedHashFor(sidecar)) {
        discard();
        host.fail(foreignSidecarMessage(target, sidecar));
      }
    }
    try {
      fs12.renameSync(tmp, sidecar);
    } catch (exc) {
      discard();
      host.fail(
        `Could not stage package content for ${target} at ${sidecar}: ${String(exc)}. Nothing was written; the managed file is unchanged.`
      );
    }
    conflictState.staged.set(sidecar, candidate);
    host.logWrite(sidecar);
  }
  function record(target, sidecar) {
    if (conflictState.preserved.includes(target)) return;
    conflictState.preserved.push(target);
    host.warn(
      conflictState.migrated.has(path11.resolve(target)) ? migrationPreservedMessage(target, sidecar) : preservedFileMessage(target, sidecar)
    );
  }
  return {
    conflictState,
    recordedDigest: recordedHashFor,
    begin(root) {
      conflictState.root = root;
      conflictState.recorded = null;
      conflictState.ledgerFiles = null;
      conflictState.logged = null;
      conflictState.preserved = [];
      conflictState.migrated = /* @__PURE__ */ new Set();
      conflictState.staged = /* @__PURE__ */ new Map();
    },
    /**
     * The on-disk digest is computed HERE rather than carried from the
     * plan: this runs immediately before the caller copies over `target`,
     * so a file edited between planning and writing is still classified
     * from the bytes that are actually about to be destroyed.
     */
    resolve(target, force, would) {
      const exists = pathExists(target);
      const recordedSha256 = exists ? recordedHashFor(target) : void 0;
      const unproven = {
        exists,
        recordedSha256,
        onDiskSha256: exists ? sha256OfFile(target) : null,
        force,
        ledgerListed: exists && ledgerLists(target),
        recordedIsStaged: typeof recordedSha256 === "string" && recordedSha256 === recordedHashFor(sidecarPathFor(target))
      };
      const loggedWrite = logProofApplies(unproven) && wroteTheseBytes(target, unproven.onDiskSha256, conflictState.logged ??= loggedWriteDigests());
      const base = { ...unproven, loggedWrite };
      const migrating = isLedgerMigration(base);
      const decision = decideDeployWrite(
        migrating ? { ...base, packagedSha256: wouldWriteDigest(target, would) } : base
      );
      if (decision === "preserve" && migrating) {
        conflictState.migrated.add(path11.resolve(target));
      }
      return decision;
    },
    /**
     * Stage the package content beside a preserved target.
     *
     * The staged bytes are what the installer WOULD have written — the
     * package file plus its install-time tag — so merging the sidecar by
     * hand yields a file that matches the digest this run records and still
     * carries the ownership evidence the reaper reads.
     */
    preserve(target, source, packageRoot) {
      const sidecar = sidecarPathFor(target);
      stageInto(target, sidecar, (tmp) => {
        fs12.copyFileSync(source, tmp);
        host.tagDeployed(tmp, source, packageRoot);
      });
      record(target, sidecar);
    },
    /**
     * The same, for a managed file the installer GENERATES rather than
     * copies (the Claude Desktop marker).
     *
     * Those writers are recorded in the manifest with a digest, so they are
     * in the class the ruling covers, and one of them wrote unconditionally
     * — ignoring even `--force` — because the tracker was wired only into
     * the copy loop.
     */
    preserveContent(target, content) {
      const sidecar = sidecarPathFor(target);
      stageInto(target, sidecar, (tmp) => fs12.writeFileSync(tmp, content, "utf-8"));
      record(target, sidecar);
    },
    /**
     * Runs before the installer's terminal NDJSON frame so that frame can
     * carry the count. A failing run keeps its own code — a conflict never
     * masks a failure.
     */
    finalizeRc(rc) {
      const count = conflictState.preserved.length;
      if (count === 0) return rc;
      host.emitProgress({ type: "conflicts", count, paths: [...conflictState.preserved] });
      host.warn(conflictSummaryMessage(count));
      return rc === 0 ? EXIT_COMPLETED_WITH_CONFLICTS : rc;
    }
  };
}

// src/install/manifestFiles.ts
var YAML3 = __toESM(require_dist(), 1);
import { existsSync as existsSync6, readFileSync as readFileSync11 } from "node:fs";
import { homedir as homedir7 } from "node:os";
import { isAbsolute as isAbsolute3, join as join14, resolve as resolve6 } from "node:path";
function fileEntry(p, kind, hashContent) {
  return { path: p, kind, sha256: hashContent ? sha256OfFile(p) : null };
}
function filesByToolFromDeploy(deployResults) {
  const out = {};
  for (const toolId of Object.keys(deployResults)) {
    const [, , status, paths] = deployResults[toolId];
    if (status === "deployed") {
      out[toolId] = paths.map((p) => fileEntry(p, "deployed", true));
    } else if (status === "marker") {
      out[toolId] = paths.map((p) => fileEntry(p, "marker", true));
    } else {
      out[toolId] = null;
    }
  }
  return out;
}
function filesByToolFromBridges(tools, projectRoot, scope, bridgeMarker) {
  const out = {};
  for (const toolId of [...tools].sort()) {
    const marker = bridgeMarker(toolId, scope);
    if (!marker) continue;
    const markerPath = isAbsolute3(marker) ? marker : join14(projectRoot, marker);
    out[toolId] = [fileEntry(markerPath, "bridge", false)];
  }
  return out;
}
function expanduser6(p) {
  if (p === "~") return homedir7();
  if (p.startsWith("~/") || process.platform === "win32" && p.startsWith("~\\")) {
    return join14(homedir7(), p.slice(2));
  }
  return p;
}
function resolveRecorded(raw, projectRoot) {
  const expanded = expanduser6(raw);
  return isAbsolute3(expanded) ? resolve6(expanded) : resolve6(projectRoot, expanded);
}
function readRecordedByTool(manifestPath, projectRoot) {
  const out = /* @__PURE__ */ new Map();
  if (!existsSync6(manifestPath)) return out;
  let doc;
  try {
    doc = YAML3.parse(readFileSync11(manifestPath, "utf8"));
  } catch {
    return out;
  }
  if (doc === null || typeof doc !== "object" || Array.isArray(doc)) return out;
  const tools = doc["tools"];
  if (!Array.isArray(tools)) return out;
  for (const tool of tools) {
    if (tool === null || typeof tool !== "object" || Array.isArray(tool)) continue;
    const rec = tool;
    const name = rec["name"];
    if (typeof name !== "string" || name.length === 0) continue;
    const files = [];
    const rawFiles = rec["files"];
    if (Array.isArray(rawFiles)) {
      for (const entry of rawFiles) {
        if (entry === null || typeof entry !== "object" || Array.isArray(entry)) continue;
        const raw = entry["path"];
        if (typeof raw !== "string" || raw.length === 0) continue;
        files.push({
          entry,
          resolved: resolveRecorded(raw, projectRoot)
        });
      }
    }
    const rawMerged = rec["merged_keys"];
    const mergedKeys = Array.isArray(rawMerged) ? rawMerged : [];
    out.set(name, { files, mergedKeys });
  }
  return out;
}
function hydrateRecordedInventories(entries, prior) {
  for (const entry of entries) {
    const name = entry["name"];
    if (typeof name !== "string") continue;
    const recorded = prior.get(name);
    if (recorded === void 0) continue;
    if (Array.isArray(entry["files"]) && entry["files"].length === 0) {
      entry["files"] = recorded.files.map((f) => f.entry);
    }
    if (Array.isArray(entry["merged_keys"]) && entry["merged_keys"].length === 0) {
      entry["merged_keys"] = [...recorded.mergedKeys];
    }
  }
  return entries;
}
function reconcileToolFiles(fresh, prior, preserved) {
  if (fresh === null || fresh === void 0) {
    return prior === void 0 ? null : prior.files.map((f) => f.entry);
  }
  if (prior === void 0 || preserved.size === 0) return [...fresh];
  const seen = /* @__PURE__ */ new Set();
  for (const entry of fresh) {
    const raw = entry["path"];
    if (typeof raw === "string") seen.add(resolve6(expanduser6(raw)));
  }
  const out = [...fresh];
  for (const file of prior.files) {
    const staged = preserved.get(file.resolved);
    if (staged === void 0 || seen.has(file.resolved)) continue;
    out.push(staged.sha256 === null ? file.entry : { ...file.entry, sha256: staged.sha256 });
    if (staged.sidecar !== null) out.push(staged.sidecar);
  }
  return out;
}
function preservedIndex(preservedTargets, staged) {
  const out = /* @__PURE__ */ new Map();
  for (const target of preservedTargets) {
    const sidecar = sidecarPathFor(target);
    const sha = staged.get(sidecar) ?? null;
    out.set(resolve6(target), {
      sha256: sha,
      sidecar: sha === null ? null : { path: sidecar, kind: "sidecar", sha256: sha }
    });
  }
  return out;
}
function dropGlobalScopeFiles(entries, deployed) {
  for (const entry of entries) {
    if (entry["scope"] === "global" && deployed.has(String(entry["name"]))) entry["files"] = [];
  }
  return entries;
}

// src/install/ownershipLedger.ts
import * as fs13 from "node:fs";
import * as path12 from "node:path";
function relUnder(anchor2, abs) {
  let real = anchor2;
  try {
    real = fs13.realpathSync(anchor2);
  } catch {
  }
  for (const base of [anchor2, real]) {
    const rel = path12.relative(path12.resolve(base), path12.resolve(abs));
    if (rel !== "" && !rel.startsWith("..") && !path12.isAbsolute(rel)) {
      return rel.split(path12.sep).join("/");
    }
  }
  return null;
}
function recordGlobalDeploy(r) {
  const inventory = load_inventory(r.inventoryPath ?? null);
  const previous = recorded_digests(r.toolId, r.anchor, inventory);
  const sidecars = /* @__PURE__ */ new Map();
  for (const [abs, digest] of r.staged) {
    const rel = relUnder(r.anchor, abs);
    if (rel !== null && digest !== null) sidecars.set(rel, digest);
  }
  const keep = /* @__PURE__ */ new Set([...r.currentFiles, ...sidecars.keys()]);
  const retainedAbs = [];
  let reaped = [];
  const tools = inventory["tools"] ?? {};
  if (r.toolId in tools) {
    reaped = reaped.concat(
      reap_stale(r.toolId, r.anchor, keep, inventory, false, retainedAbs)
    );
  }
  reaped = reaped.concat(
    reap_tagged_orphans(
      r.anchor,
      [...r.destSubs],
      keep,
      r.packageTag,
      false,
      previous,
      retainedAbs
    )
  );
  const preservedRel = /* @__PURE__ */ new Set();
  for (const abs of r.preserved) {
    const rel = relUnder(r.anchor, abs);
    if (rel !== null) preservedRel.add(rel);
  }
  const digests = /* @__PURE__ */ new Map();
  for (const rel of r.currentFiles) {
    const abs = path12.join(r.anchor, rel);
    if (preservedRel.has(rel)) {
      const staged = r.staged.get(sidecarPathFor(abs)) ?? null;
      const installed = staged ?? previous.get(rel)?.installed_sha256 ?? r.recordedFor(abs);
      if (typeof installed !== "string" || installed === "") continue;
      digests.set(rel, { installed_sha256: installed, packaged_sha256: staged ?? installed });
      continue;
    }
    const onDisk = file_sha256(abs);
    if (onDisk === null) continue;
    digests.set(rel, { installed_sha256: onDisk, packaged_sha256: onDisk });
  }
  for (const [rel, digest] of sidecars) {
    digests.set(rel, { installed_sha256: digest, packaged_sha256: digest, kind: "sidecar" });
  }
  const retained = [...new Set(retainedAbs)].sort();
  for (const abs of retained) {
    const rel = relUnder(r.anchor, abs);
    const prior = rel === null ? void 0 : previous.get(rel);
    if (rel === null || prior === void 0) continue;
    digests.set(rel, { installed_sha256: prior.installed_sha256, packaged_sha256: null });
  }
  record_deploy(r.toolId, r.anchorRaw, new Set(r.currentFiles), inventory, digests);
  save_inventory(inventory, r.inventoryPath ?? null);
  return { reaped: [...new Set(reaped)].sort(), retained };
}
function retainedFileMessage(target) {
  return `Kept ${target}: the package no longer ships this file, but it was edited after it was installed, so it was not deleted. It is no longer updated by agent-config; delete it yourself when you no longer need it.`;
}

// src/scripts/_lib/rule_layer_overlap.ts
import * as fs14 from "node:fs";
import * as os6 from "node:os";
import * as path13 from "node:path";
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
function hostRuleLayerDirs(projectRoot) {
  return [
    path13.join(os6.homedir(), ".claude", "rules"),
    path13.join(projectRoot, ".claude", "rules")
  ];
}
function readRuleLayer(dir) {
  let names;
  try {
    names = fs14.readdirSync(dir);
  } catch {
    return null;
  }
  const files = /* @__PURE__ */ new Map();
  for (const name of names.filter((n) => n.endsWith(".md")).sort()) {
    try {
      files.set(name, fs14.readFileSync(path13.join(dir, name), "utf-8"));
    } catch {
      continue;
    }
  }
  return { dir, files };
}
function claudeMdExcludesGlob(dir) {
  return `${path13.resolve(dir).replace(/\/+$/, "")}/**`;
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

// src/scripts/_lib/install_drift.ts
var import_yaml = __toESM(require_dist(), 1);
import * as crypto3 from "node:crypto";
import * as fs15 from "node:fs";
import * as os7 from "node:os";
import * as path14 from "node:path";
function expanduser7(p) {
  if (p === "~") {
    return os7.homedir();
  }
  if (p.startsWith("~/") || process.platform === "win32" && p.startsWith("~\\")) {
    return path14.join(os7.homedir(), p.slice(2));
  }
  return p;
}
function resolve_entry_path(project_root, raw) {
  const p = expanduser7(raw);
  return path14.isAbsolute(p) ? p : path14.join(project_root, p);
}
function sha256_of_file(p) {
  try {
    return crypto3.createHash("sha256").update(fs15.readFileSync(p)).digest("hex");
  } catch {
    return null;
  }
}
function collect_drift(project_root, env) {
  const target = manifest_path(project_root, env);
  let text;
  try {
    text = fs15.readFileSync(target, "utf-8");
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
      if (!fs15.existsSync(resolved)) {
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

// src/scripts/_lib/gitignore_block.ts
import * as fs16 from "node:fs";
import * as path15 from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
var SECTION_HEADER = "# event4u/agent-config";
var SECTION_FOOTER = "# event4u/agent-config \u2014 END";
var DEFAULT_GITIGNORE = ".gitignore";
var _HERE = fileURLToPath2(import.meta.url);
var DEFAULT_TEMPLATE = path15.join(
  path15.dirname(_HERE),
  "..",
  "..",
  "..",
  "src",
  "config",
  "gitignore-block.txt"
);
function _strip(ln) {
  return ln.replace(/\n+$/, "").replace(/\s+$/, "");
}
function _is_entry(ln) {
  const s = _strip(ln).replace(/^\s+/, "");
  return Boolean(s) && !s.startsWith("#");
}
var TemplateNotFoundError = class extends Error {
  constructor(p) {
    super(`template not found: ${p}`);
    this.name = "TemplateNotFoundError";
  }
};
function _isFile(p) {
  try {
    return fs16.statSync(p).isFile();
  } catch {
    return false;
  }
}
function _splitlines(text) {
  if (text === "") return [];
  const parts = text.split(/\r\n|\r|\n/);
  if (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();
  return parts;
}
function load_template(p) {
  if (!_isFile(p)) {
    throw new TemplateNotFoundError(p);
  }
  const text = fs16.readFileSync(p, "utf-8");
  return _splitlines(text).map(_strip);
}
function find_block(lines) {
  for (let i = 0; i < lines.length; i += 1) {
    if (_strip(lines[i]) === SECTION_HEADER) {
      const start = i;
      for (let j = i + 1; j < lines.length; j += 1) {
        if (_strip(lines[j]) === SECTION_FOOTER) {
          return [start, j + 1];
        }
      }
      let end = lines.length;
      for (let j = i + 1; j < lines.length; j += 1) {
        const s = _strip(lines[j]).replace(/^\s+/, "");
        if (s.startsWith("#") && !s.startsWith("# Agent config") && s !== SECTION_HEADER) {
          end = j;
          while (end > i + 1 && _strip(lines[end - 1]) === "") {
            end -= 1;
          }
          break;
        }
      }
      return [start, end];
    }
  }
  return null;
}
function block_entries(block_lines) {
  return block_lines.filter((ln) => _is_entry(ln)).map((ln) => _strip(ln).replace(/^\s+/, ""));
}
function template_entries(template_lines) {
  return template_lines.filter((ln) => _is_entry(ln)).map((ln) => ln.replace(/^\s+/, ""));
}
function build_fresh_block(template_lines) {
  return [SECTION_HEADER, ...template_lines, SECTION_FOOTER];
}
function sync_block(existing_lines, template_lines, options = {}) {
  const replace = options.replace ?? false;
  const loc = find_block(existing_lines);
  const fresh = build_fresh_block(template_lines);
  if (loc === null) {
    const newLines = [...existing_lines];
    if (newLines.length > 0 && _strip(newLines[newLines.length - 1]) !== "") {
      newLines.push("");
    }
    newLines.push(...fresh);
    return [newLines, template_entries(template_lines)];
  }
  const [start, end] = loc;
  const head = existing_lines.slice(0, start);
  let block = existing_lines.slice(start, end);
  const tail = existing_lines.slice(end);
  if (replace) {
    const existing = new Set(block_entries(block));
    const added = template_entries(template_lines).filter((e) => !existing.has(e));
    return [[...head, ...fresh, ...tail], added];
  }
  const existing_entries = new Set(block_entries(block));
  const missing = template_entries(template_lines).filter((e) => !existing_entries.has(e));
  if (missing.length === 0) {
    return [[...existing_lines], []];
  }
  let insert_at;
  if (block.length > 0 && _strip(block[block.length - 1]) === SECTION_FOOTER) {
    insert_at = block.length - 1;
  } else {
    block = [...block, SECTION_FOOTER];
    insert_at = block.length - 1;
  }
  const new_block = [...block.slice(0, insert_at), ...missing, ...block.slice(insert_at)];
  return [[...head, ...new_block, ...tail], missing];
}
function format_file(lines) {
  const text = lines.join("\n");
  return text.replace(/\n+$/, "") + "\n";
}
function write_managed_block(project_root, dry_run) {
  const target = path15.join(project_root, DEFAULT_GITIGNORE);
  let template;
  try {
    template = load_template(DEFAULT_TEMPLATE);
  } catch {
    return 0;
  }
  let existing = [];
  if (_isFile(target)) {
    existing = _splitlines(fs16.readFileSync(target, "utf-8"));
  } else if (!_isFile(path15.join(project_root, ".git")) && !_isDir(path15.join(project_root, ".git"))) {
    return 0;
  }
  const [lines, added] = sync_block(existing, template);
  if (added.length === 0 || dry_run) return added.length;
  try {
    fs16.writeFileSync(target, format_file(lines), "utf-8");
  } catch {
    return 0;
  }
  return added.length;
}
function _isDir(p) {
  try {
    return fs16.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

// src/scripts/_lib/skill_catalogue.ts
import * as fs17 from "node:fs";
import * as path16 from "node:path";
var PROJECT_CATALOGUE_ROOTS = ["src/skills", ".claude/skills"];
var HOST_CATALOGUE_ROOT = ".claude/skills";
var DEFAULT_CATALOGUE_ROOTS = [
  ...PROJECT_CATALOGUE_ROOTS,
  `~/${HOST_CATALOGUE_ROOT}`
];
var PACKAGE_FALLBACK_CATALOGUE_ROOT = path16.join("dist", "agent-src", "skills");
var OBSERVATION_LOG = path16.join(
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
  const names = fs17.readdirSync(root).filter((n) => fs17.existsSync(path16.join(root, n, "SKILL.md"))).sort();
  return names.map((name, index) => {
    const content = fs17.readFileSync(path16.join(root, name, "SKILL.md"), "utf-8");
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
  if (!fs17.existsSync(root)) return [];
  const out = [];
  const walk = (dir) => {
    for (const entry of fs17.readdirSync(dir, { withFileTypes: true })) {
      const full = path16.join(dir, entry.name);
      if (fs17.statSync(full).isDirectory()) walk(full);
      else if (entry.name.endsWith(".md")) out.push(full);
    }
  };
  walk(root);
  return out;
}
function measureCatalogueVolume(host, root) {
  const skillsRoot = path16.join(root, "skills");
  const skills = fs17.existsSync(skillsRoot) ? readProjectedCatalogue(skillsRoot) : [];
  const commandEntries = markdownFilesUnder(path16.join(root, "commands")).length;
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
  if (!fs17.existsSync(logPath)) return [];
  const out = [];
  for (const line of fs17.readFileSync(logPath, "utf-8").split("\n")) {
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
import * as crypto4 from "node:crypto";
import * as fs18 from "node:fs";
import * as path17 from "node:path";

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
    return fs18.statSync(p).isDirectory();
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
  const resolved = fs18.realpathSync(skill_dir);
  const walk = (root, relRoot) => {
    const dirNames = [];
    const fileNames = [];
    for (const dirent of fs18.readdirSync(root, { withFileTypes: true })) {
      const full = path17.join(root, dirent.name);
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
      out.push([path17.join(root, fname), rel_parts]);
    }
    for (const dname of dirNames) {
      if (_is_excluded([dname])) {
        continue;
      }
      walk(path17.join(root, dname), [...relRoot, dname]);
    }
  };
  walk(resolved, []);
  out.sort((x, y) => _compare_rel_parts(x[1], y[1]));
  return out;
}
function _manifest_digest(files) {
  const h = crypto4.createHash("sha256");
  for (const [abs_path, rel_parts] of files) {
    const rel = rel_parts.join("/");
    h.update(Buffer.from(rel, "utf-8"));
    h.update(Buffer.from([0]));
    h.update(crypto4.createHash("sha256").update(fs18.readFileSync(abs_path)).digest());
    h.update(Buffer.from([0]));
  }
  return h.digest("hex");
}
function _atomic_write_zip(zip_path, files) {
  fs18.mkdirSync(path17.dirname(zip_path), { recursive: true });
  const stem = path17.basename(zip_path, path17.extname(zip_path));
  const tmp_path = path17.join(
    path17.dirname(zip_path),
    `.${stem}.${crypto4.randomBytes(6).toString("hex")}.zip.tmp`
  );
  try {
    const entries = files.map(([abs_path, rel_parts]) => ({
      name: rel_parts.join("/"),
      data: fs18.readFileSync(abs_path)
    }));
    fs18.writeFileSync(tmp_path, zip_write_sync(entries));
    fs18.renameSync(tmp_path, zip_path);
  } finally {
    if (fs18.existsSync(tmp_path)) {
      fs18.unlinkSync(tmp_path);
    }
  }
}
function _write_if_changed(dest_dir, slug, files, force, written) {
  const digest = _manifest_digest(files);
  const zip_path = path17.join(dest_dir, `${slug}.zip`);
  const digest_path = path17.join(dest_dir, `${slug}.sha256`);
  const recorded = fs18.existsSync(digest_path) ? fs18.readFileSync(digest_path, "utf-8").trim() : "";
  if (!force && recorded === digest && fs18.existsSync(zip_path)) {
    return;
  }
  _atomic_write_zip(zip_path, files);
  fs18.writeFileSync(digest_path, digest + "\n", "utf-8");
  written.push(zip_path);
}
function build_skill_bundles(package_root, dest_dir, force = false, curation = null) {
  const skills_root = path17.join(package_root, "dist/agent-src", "skills");
  if (!_is_dir(skills_root)) {
    return [];
  }
  fs18.mkdirSync(dest_dir, { recursive: true });
  const written = [];
  for (const name of fs18.readdirSync(skills_root).sort()) {
    const entry = path17.join(skills_root, name);
    const isSymlink2 = fs18.lstatSync(entry).isSymbolicLink();
    if (!(_is_dir(entry) || isSymlink2)) {
      continue;
    }
    const skill_name = name;
    if (curation !== null && !curation.includes(skill_name)) {
      continue;
    }
    const skill_md = path17.join(entry, "SKILL.md");
    if (!fs18.existsSync(skill_md)) {
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
  const rel = path17.relative(commands_root, source_file);
  const noExt = rel.slice(0, rel.length - path17.extname(rel).length);
  return noExt.split(path17.sep).join("-");
}
function _iter_command_files(commands_root) {
  const found = [];
  const walk = (dir) => {
    for (const dirent of fs18.readdirSync(dir, { withFileTypes: true })) {
      const full = path17.join(dir, dirent.name);
      if (dirent.isDirectory() || dirent.isSymbolicLink() && _is_dir(full)) {
        walk(full);
      } else if (dirent.name.endsWith(".md")) {
        found.push(full);
      }
    }
  };
  walk(commands_root);
  found.sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  return found.filter((source_file) => path17.basename(source_file) !== "AGENTS.md");
}
function build_command_bundles(package_root, dest_dir, force = false, curation = null) {
  const commands_root = path17.join(package_root, "dist/agent-src", "commands");
  if (!_is_dir(commands_root)) {
    return [];
  }
  const skills_root = path17.join(package_root, "dist/agent-src", "skills");
  let skill_names = /* @__PURE__ */ new Set();
  if (_is_dir(skills_root)) {
    skill_names = new Set(
      fs18.readdirSync(skills_root).filter((name) => _is_dir(path17.join(skills_root, name)))
    );
  }
  fs18.mkdirSync(dest_dir, { recursive: true });
  const written = [];
  for (const source_file of _iter_command_files(commands_root)) {
    const slug = _command_slug(source_file, commands_root);
    if (skill_names.has(slug)) {
      continue;
    }
    if (curation !== null && !curation.includes(slug)) {
      continue;
    }
    const files = [[fs18.realpathSync(source_file), ["SKILL.md"]]];
    _write_if_changed(dest_dir, slug, files, force, written);
  }
  return written;
}

// src/scripts/_lib/claude_settings_hooks.ts
var YAML4 = __toESM(require_dist(), 1);
import * as fs19 from "node:fs";
import * as path18 from "node:path";

// src/install/atomic.ts
import {
  closeSync as closeSync3,
  fsyncSync,
  mkdirSync as mkdirSync6,
  openSync as openSync3,
  readFileSync as readFileSync17,
  renameSync as renameSync6,
  unlinkSync as unlinkSync6,
  writeSync
} from "node:fs";
import { dirname as dirname8, join as join21 } from "node:path";
function atomicWriteFile(target, data, options = {}) {
  const mode = options.mode ?? 420;
  const parent = dirname8(target);
  mkdirSync6(parent, { recursive: true });
  const tmp = join21(parent, `.tmp.${process.pid}.${randSuffix()}`);
  let fd = null;
  try {
    fd = openSync3(tmp, "w", mode);
    const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
    writeSync(fd, buf, 0, buf.length, 0);
    fsyncSync(fd);
    closeSync3(fd);
    fd = null;
    renameSync6(tmp, target);
  } catch (err) {
    if (fd !== null) {
      try {
        closeSync3(fd);
      } catch {
      }
    }
    try {
      unlinkSync6(tmp);
    } catch {
    }
    throw err;
  }
}
function atomicAppendLine(target, line) {
  let existing = "";
  try {
    existing = readFileSync17(target, "utf8");
  } catch {
    existing = "";
  }
  const sep11 = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  atomicWriteFile(target, `${existing}${sep11}${line}
`);
}
function randSuffix() {
  return Math.floor(Math.random() * 281474976710655).toString(16).padStart(12, "0");
}

// src/scripts/_lib/claude_settings_hooks.ts
function _yaml_parse(text) {
  return YAML4.parse(text);
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
  const raw = fs19.readFileSync(manifest_path2, "utf8");
  const manifest = _yaml_parse(raw) ?? {};
  const hook_spec = manifest["schema_version"] ?? 1;
  const platforms = manifest["platforms"] ?? {};
  const claude_events = (platforms["claude"] ?? {}) || {};
  const aliasesAll = manifest["native_event_aliases"] ?? {};
  const aliases = (aliasesAll["claude"] ?? {}) || {};
  const matrix = {};
  for (const [native, ac_raw] of Object.entries(aliases)) {
    const ac_event = String(ac_raw);
    const concerns = claude_events[ac_event];
    if (!concerns || Array.isArray(concerns) && concerns.length === 0) continue;
    const dispatchArgs = `--platform claude --event ${ac_event} --native-event ${native} --project-dir "$CLAUDE_PROJECT_DIR" --min-version ${String(hook_spec)}`;
    matrix[native] = `R="\${EVENT4U_CONFIG_HOME:-$HOME/.event4u/agent-config}/runtime"; S="$R/current"; N=""; [ -f "$S/node" ] && read -r N < "$S/node"; if [ -n "$N" ] && [ -x "$N" ] && [ -f "$S/dist/hooks/dispatch.js" ]; then ${native === "PreToolUse" ? "" : "exec "}"$N" "$S/dist/hooks/dispatch.js" ${dispatchArgs}; ${native === "PreToolUse" ? "else " : "fi; "}BIN=$(command -v agent-config); [ "\${BIN#/}" = "$BIN" ] && BIN=""; [ -n "$CLAUDE_PROJECT_DIR" ] && [ "\${BIN#"$CLAUDE_PROJECT_DIR"/}" != "$BIN" ] && BIN=""; [ -n "$BIN" ] || { ${_no_dispatcher_notice(native)}${_thinned_dead_carrier(native)}${_no_dispatcher_exit(native)} }; "$BIN" dispatch:hook ${dispatchArgs}` + (native === "PreToolUse" ? _pre_tool_use_exit_guard() : "");
  }
  return matrix;
}
var NO_DISPATCHER_STDERR = "agent-config: no hook dispatcher reachable, so no agent-config hook runs in this session. Hooks need the npm package where they can reach it: npm i -g @event4u/agent-config (then npx -y @event4u/agent-config init)";
var NO_DISPATCHER_CONTEXT = "agent-config hooks are NOT running in this session: the plugin found no dispatcher, so no concern runs, the fail_closed guards block-no-verify, block-kernel-rule-writes and block-plumbing-writes included.";
function _no_dispatcher_notice(native) {
  const context = native === "SessionStart" ? ` echo '${NO_DISPATCHER_CONTEXT}';` : "";
  return `[ -n "$CLAUDE_PLUGIN_ROOT" ] && { echo '${NO_DISPATCHER_STDERR}' >&2;${context} }; `;
}
var NO_DISPATCHER_REFUSAL = "agent-config: no hook dispatcher reachable, so this tool call is refused: the fail_closed guards block-no-verify, block-kernel-rule-writes and block-plumbing-writes cannot run. Repair in a terminal: npm i -g @event4u/agent-config then npx -y @event4u/agent-config init. To drop the hooks instead: agent-config uninstall, or delete the agent-config entries from ~/.claude/settings.json.";
function _no_dispatcher_exit(native) {
  if (native !== "PreToolUse") return "exit 0;";
  return `[ -z "$CLAUDE_PLUGIN_ROOT" ] && { echo '${NO_DISPATCHER_REFUSAL}' >&2; exit 2; }; exit 0;`;
}
var DISPATCHER_FAILED_REFUSAL = "agent-config: the hook dispatcher did not return a verdict, so this tool call is refused: the fail_closed guards could not decide. If an agent-config upgrade is running, retry once it has finished.";
function _pre_tool_use_exit_guard() {
  return `; fi; RC=$?; [ "$RC" = 0 ] || [ "$RC" = 2 ] || { echo '${DISPATCHER_FAILED_REFUSAL}' >&2; exit 2; }; exit $RC`;
}
var THINNED_DEAD_CARRIER_LINE = "agent-config: no hook dispatcher was reached and the rule layer on disk is thinned, so routed rule bodies will not arrive in this session. Open a rule body from the absolute Body path in its stub. The full rule layer is restored for the next session.";
function _thinned_dead_carrier(native) {
  if (native !== "SessionStart") return "";
  return `[ -z "$AC_HOOK_PROBE" ] && [ -f "$R/thinned" ] && { echo '${THINNED_DEAD_CARRIER_LINE}'; L=""; read -r L < "$R/thinned"; F=1; if [ -d "$L" ] && [ -d "$S/claude-rules" ]; then F=0; for f in "$S/claude-rules"/*.md; do [ -f "$f" ] || continue; t="$L/\${f##*/}"; if [ ! -e "$t" ] || grep -qx "package: event4u/agent-config" "$t"; then cp "$f" "$t.ac-restore" && mv -f "$t.ac-restore" "$t" || F=1; fi; done; fi; [ "$F" = 0 ] && mv -f "$R/thinned" "$R/demoted"; }; `;
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
  if (!fs19.existsSync(settings_path)) return {};
  const raw = fs19.readFileSync(settings_path, "utf8");
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
  fs19.mkdirSync(path18.dirname(lockPath), { recursive: true });
  let fd;
  try {
    fd = fs19.openSync(lockPath, "wx");
  } catch {
    throw new SettingsLockError(lockPath);
  }
  try {
    return fn();
  } finally {
    fs19.closeSync(fd);
    fs19.rmSync(lockPath, { force: true });
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

// src/scripts/_lib/skill_listing_overrides.ts
import * as fs22 from "node:fs";
import * as path21 from "node:path";

// src/scripts/_lib/host_listing_model.ts
var CLAUDE_CODE_LISTING_DEFAULTS = {
  fraction: 0.01,
  perEntryCapChars: 1536,
  charsPerToken: 4,
  perEntryOverheadChars: 0
};
var ASSUMPTIONS = [
  {
    id: "budget-unit-is-chars",
    provenance: "upstream-prose",
    why: 'The docs give the budget as a fraction of the context window (tokens); the 2026-08-22 read illustrated it as "\u22488,000 characters on 200k" (gone by 2026-10-14), which only reconciles at 4 chars per token. That ratio is inferred, never stated.'
  },
  {
    id: "fill-order-is-invocation-frequency",
    provenance: "upstream-prose",
    why: "Upstream says the budget fills by invocation frequency, but does not say what orders entries when no invocation history exists. This model falls back to alphabetical, which is this repo's choice and not upstream behaviour."
  },
  {
    id: "names-are-never-dropped",
    provenance: "upstream-prose",
    why: "Claude Code lists every name and budgets only descriptions. Another host (codex) drops whole entries instead, so this is a per-host property and is not transferable to a second host without its own model."
  },
  {
    id: "stop-at-first-overflow",
    provenance: "upstream-prose",
    why: "The docs describe filling a budget, not packing one. A shorter later entry might in principle still fit after a longer one has overflowed; this model stops at the first entry that does not fit rather than skipping past it."
  },
  {
    id: "wrapper-overhead-unmodelled",
    provenance: "upstream-prose",
    why: "Each delivered entry also costs its name, separators and newlines. Upstream quantifies none of that, so the default overhead here is 0 and the budget is therefore an upper bound on how many descriptions survive."
  }
];
function modelListingBudget(catalogue, input) {
  const fraction = input.fraction ?? CLAUDE_CODE_LISTING_DEFAULTS.fraction;
  const perEntryCap = input.perEntryCapChars ?? CLAUDE_CODE_LISTING_DEFAULTS.perEntryCapChars;
  const charsPerToken = input.charsPerToken ?? CLAUDE_CODE_LISTING_DEFAULTS.charsPerToken;
  const overhead = input.perEntryOverheadChars ?? CLAUDE_CODE_LISTING_DEFAULTS.perEntryOverheadChars;
  const usageOrder = input.usageOrder ?? [];
  const budgetChars = Math.floor(input.contextWindowTokens * fraction * charsPerToken);
  const fillOrder = usageOrder.length > 0 ? "usage" : "alphabetical-fallback";
  const byName = new Map(catalogue.map((e) => [e.name, e]));
  const ordered = [];
  const seen = /* @__PURE__ */ new Set();
  for (const name of usageOrder) {
    const e = byName.get(name);
    if (e && !seen.has(name)) {
      ordered.push(e);
      seen.add(name);
    }
  }
  const rest = catalogue.filter((e) => !seen.has(e.name)).slice().sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  ordered.push(...rest);
  const surviving = [];
  const bare = [];
  let spentChars = 0;
  let overflowed = false;
  for (const e of ordered) {
    if (overflowed) {
      bare.push(e.name);
      continue;
    }
    const cost = Math.min(e.descriptionChars, perEntryCap) + overhead;
    if (spentChars + cost <= budgetChars) {
      surviving.push(e.name);
      spentChars += cost;
    } else {
      overflowed = true;
      bare.push(e.name);
    }
  }
  return { budgetChars, fillOrder, surviving, bare, spentChars, assumptions: ASSUMPTIONS };
}

// src/scripts/_lib/codex_resident_set.ts
import { createHash as createHash7 } from "node:crypto";
import * as fs21 from "node:fs";
import * as path20 from "node:path";

// src/scripts/_lib/codex_skill_finder.ts
import { createHash as createHash6 } from "node:crypto";
import * as fs20 from "node:fs";
import * as path19 from "node:path";
var FINDER_NAME = "agent-config-skill-finder";
function finderDescription(count) {
  return `Use when no listed skill fits the task, or the user names a skill not in this list \u2014 ${count} more agent-config skills are installed here but unlisted; this finds and loads one.`;
}
var SKILL_NAME_RE = /^[a-z0-9][a-z0-9-]*$/;
function renderFinder(targets) {
  const safe = targets.filter((t) => SKILL_NAME_RE.test(t.name) && !/[\r\n]/.test(t.skillsDir));
  const sorted = [...safe].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  const byDir = /* @__PURE__ */ new Map();
  for (const t of sorted) {
    const list = byDir.get(t.skillsDir) ?? [];
    list.push(t.name);
    byDir.set(t.skillsDir, list);
  }
  const out = [
    "---",
    `name: ${FINDER_NAME}`,
    `description: ${finderDescription(sorted.length)}`,
    "---",
    "",
    "# Loading an unlisted agent-config skill",
    "",
    `This host lists only part of the agent-config catalogue, to stay inside its skills budget. The ${sorted.length} skills indexed below are installed and complete; they are only not listed. Load one by reading its SKILL.md WHOLE \u2014 \`cat <path>\`, never a ranged read, because the last lines bind as much as the first \u2014 and following it as if it had been invoked.`,
    "",
    "## The user named a skill",
    "",
    "1. Look the name up in the index below. Exact match only \u2014 a near-miss is not a match.",
    "2. Found: `cat <directory>/<name>/SKILL.md`, the directory being the heading it is listed under, and follow it.",
    "3. Not found: say that no skill of that name is installed, and name the closest entries. Never read a path built from text the index does not contain.",
    "",
    "## The task needs a skill no listed entry covers",
    "",
    '1. Run `agent-config route:explain --skills "<the task in one sentence>"`. It ranks every skill by the task and prints each name with its description.',
    "2. If that command is not available, choose from the index below by name.",
    "3. `cat` the chosen skill's SKILL.md from its index heading, follow it, and say which skill you loaded and that it came through this finder.",
    "4. Nothing fits: say so and proceed without a skill. Never invent one.",
    "",
    `## Index (${sorted.length})`
  ];
  for (const [dir, names] of byDir) {
    out.push("", `### ${dir}`, "", names.join(", "));
  }
  return `${out.join("\n")}
`;
}
function sha256(text) {
  return createHash6("sha256").update(text).digest("hex");
}
function readRecord(file, anchor2) {
  try {
    const r = JSON.parse(fs20.readFileSync(file, "utf-8"));
    if (typeof r.sha256 !== "string" || path19.resolve(String(r.anchor)) !== path19.resolve(anchor2)) return null;
    return { schema_version: 1, anchor: anchor2, sha256: r.sha256 };
  } catch {
    return null;
  }
}
function finderFile(anchor2) {
  return path19.join(anchor2, "skills", FINDER_NAME, "SKILL.md");
}
function ours(anchor2, recordFile) {
  const file = finderFile(anchor2);
  if (!fs20.existsSync(path19.dirname(file))) return true;
  const rec = readRecord(recordFile, anchor2);
  if (rec === null) return false;
  if (!fs20.existsSync(file)) return true;
  return sha256(fs20.readFileSync(file, "utf-8")) === rec.sha256;
}
function ensureCodexFinder(anchor2, recordFile, targets) {
  if (targets.length === 0) return removeCodexFinder(anchor2, recordFile);
  if (!ours(anchor2, recordFile)) return "foreign";
  const body = renderFinder(targets);
  const file = finderFile(anchor2);
  if (fs20.existsSync(file) && fs20.readFileSync(file, "utf-8") === body) return "unchanged";
  atomicWriteFile(file, body);
  fs20.mkdirSync(path19.dirname(recordFile), { recursive: true });
  atomicWriteFile(
    recordFile,
    `${JSON.stringify({ schema_version: 1, anchor: anchor2, sha256: sha256(body) }, null, 2)}
`
  );
  return "written";
}
function removeCodexFinder(anchor2, recordFile) {
  const file = finderFile(anchor2);
  if (!fs20.existsSync(path19.dirname(file))) {
    fs20.rmSync(recordFile, { force: true });
    return "absent";
  }
  if (!ours(anchor2, recordFile)) return "foreign";
  fs20.rmSync(file, { force: true });
  try {
    if (fs20.readdirSync(path19.dirname(file)).length === 0) fs20.rmdirSync(path19.dirname(file));
  } catch {
  }
  fs20.rmSync(recordFile, { force: true });
  return "removed";
}

// src/scripts/_lib/codex_resident_set.ts
var RECORD_DIRNAME = "codex-resident-set";
var POLICY_REL = path20.join("agents", "openai.yaml");
var CODEX_BUDGET_CHARS = 8e3;
var POLICY_BODY = "policy:\n  allow_implicit_invocation: false\n";
var ASSUMPTIONS2 = [
  {
    id: "entry-cost-is-name-plus-description",
    provenance: "upstream-prose",
    why: 'The host reports a "skills context budget" in characters and does not publish the serialisation it bills. This model bills a name plus its description, which is what the injected list visibly carries.'
  },
  {
    id: "per-entry-overhead",
    provenance: "estimate",
    why: "Each entry also costs separators and a newline. The host quantifies none of it, so the default here is 5 characters per entry and the resulting resident set is therefore an estimate of what fits, never a guarantee \u2014 too small, never too large."
  },
  {
    id: "fill-order-alphabetical",
    provenance: "first-party-observation",
    why: "The 0.3 probe observed the host itself dropping from the alphabetical tail of the user scope. With no usage ledger to order by, filling alphabetically makes the package pick the SAME set the host would have picked, so the resident set is the host's own survivors made explicit rather than a second, conflicting order."
  }
];
var DEFAULT_PER_ENTRY_OVERHEAD_CHARS = 5;
function computeCodexResidentSet(catalogue, opts) {
  const budgetChars = opts?.budgetChars ?? CODEX_BUDGET_CHARS;
  const overhead = opts?.perEntryOverheadChars ?? DEFAULT_PER_ENTRY_OVERHEAD_CHARS;
  const ordered = catalogue.slice().sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  const resident = [];
  const nonResident = [];
  let listingChars = 0;
  let overflowed = false;
  for (const e of ordered) {
    const cost = e.name.length + e.descriptionChars + overhead;
    if (overflowed || listingChars + cost > budgetChars) {
      overflowed = true;
      nonResident.push(e.name);
      continue;
    }
    resident.push(e.name);
    listingChars += cost;
  }
  return { budgetChars, resident, nonResident, listingChars, assumptions: ASSUMPTIONS2 };
}
function recordPath(anchor2, env) {
  const key = createHash7("sha256").update(path20.resolve(anchor2)).digest("hex").slice(0, 16);
  return path20.join(write_target(RECORD_DIRNAME, { env: env ?? null }), `${key}.json`);
}
function finderRecordPath(anchor2, env) {
  return recordPath(anchor2, env).replace(/\.json$/, ".finder.json");
}
function codexSkillRoots(home) {
  return [path20.join(home, ".codex"), path20.join(home, ".agents")].filter(
    (a) => fs21.existsSync(path20.join(a, "skills"))
  );
}
function ownedCatalogue(skillsDir, owned) {
  const out = [];
  for (const name of owned) {
    let raw;
    try {
      raw = fs21.readFileSync(path20.join(skillsDir, name, "SKILL.md"), "utf8");
    } catch {
      continue;
    }
    const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
    const line = fm ? /^description:[ \t]*(.*)$/m.exec(fm[1]) : null;
    out.push({ name, descriptionChars: line ? line[1].replace(/^["']|["']$/g, "").length : 0 });
  }
  return out;
}
function loadRecord(file, anchor2) {
  const empty = { schema_version: 1, anchor: anchor2, written: [] };
  let data;
  try {
    data = JSON.parse(fs21.readFileSync(file, "utf-8"));
  } catch {
    return empty;
  }
  const r = data;
  if (!r || typeof r !== "object" || !Array.isArray(r.written)) return empty;
  if (path20.resolve(String(r.anchor)) !== path20.resolve(anchor2)) return empty;
  return { schema_version: 1, anchor: anchor2, written: r.written.filter((x) => typeof x === "string") };
}
function saveRecord(file, rec) {
  if (rec.written.length === 0) {
    fs21.rmSync(file, { force: true });
    return;
  }
  fs21.mkdirSync(path20.dirname(file), { recursive: true });
  const sorted = { ...rec, written: [...rec.written].sort() };
  atomicWriteFile(file, `${JSON.stringify(sorted, null, 2)}
`);
}
function dropPolicy(abs) {
  fs21.rmSync(abs, { force: true });
  const dir = path20.dirname(abs);
  try {
    if (fs21.readdirSync(dir).length === 0) fs21.rmdirSync(dir);
  } catch {
  }
}
function ensureCodexResidentSet(anchor2, recordFile, nonResident) {
  const skillsDir = path20.join(anchor2, "skills");
  const rec = loadRecord(recordFile, anchor2);
  const result = { changed: false, disabled: [], reenabled: [], skipped_foreign: [] };
  const want = new Set(nonResident);
  const ours2 = new Set(rec.written);
  const next = [];
  for (const rel of rec.written) {
    const abs = path20.join(anchor2, rel);
    const name = rel.split(path20.sep)[1] ?? "";
    if (!fs21.existsSync(abs)) continue;
    if (fs21.readFileSync(abs, "utf-8") !== POLICY_BODY) continue;
    if (want.has(name)) {
      next.push(rel);
      continue;
    }
    dropPolicy(abs);
    result.reenabled.push(name);
  }
  for (const name of [...want].sort()) {
    const rel = path20.join("skills", name, POLICY_REL);
    if (ours2.has(rel) && next.includes(rel)) continue;
    const dir = path20.join(skillsDir, name);
    if (!fs21.existsSync(dir)) continue;
    const abs = path20.join(anchor2, rel);
    if (fs21.existsSync(abs) && fs21.readFileSync(abs, "utf-8") !== POLICY_BODY) {
      result.skipped_foreign.push(name);
      continue;
    }
    fs21.mkdirSync(path20.dirname(abs), { recursive: true });
    atomicWriteFile(abs, POLICY_BODY);
    next.push(rel);
    result.disabled.push(name);
  }
  result.changed = result.disabled.length > 0 || result.reenabled.length > 0;
  saveRecord(recordFile, { schema_version: 1, anchor: anchor2, written: next });
  result.disabled.sort();
  result.reenabled.sort();
  result.skipped_foreign.sort();
  return result;
}
function applyCodexResidentSet(home, report) {
  try {
    const roots = codexSkillRoots(home);
    if (roots.length === 0) return;
    const firstRootOf = /* @__PURE__ */ new Map();
    const catalogue = [];
    for (const anchor2 of roots) {
      const skillsDir = path20.join(anchor2, "skills");
      const owned = fs21.readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== FINDER_NAME && fs21.existsSync(path20.join(skillsDir, d.name, "SKILL.md"))).map((d) => d.name);
      for (const e of ownedCatalogue(skillsDir, owned)) {
        if (firstRootOf.has(e.name)) continue;
        firstRootOf.set(e.name, anchor2);
        catalogue.push(e);
      }
    }
    const finderCost = FINDER_NAME.length + finderDescription(catalogue.length).length + DEFAULT_PER_ENTRY_OVERHEAD_CHARS;
    let split = computeCodexResidentSet(catalogue);
    if (split.nonResident.length > 0) {
      split = computeCodexResidentSet(catalogue, { budgetChars: CODEX_BUDGET_CHARS - finderCost });
    }
    const resident = new Set(split.resident);
    const finder = ensureCodexFinder(
      roots[0],
      finderRecordPath(roots[0]),
      split.nonResident.map((name) => ({ name, skillsDir: path20.join(firstRootOf.get(name), "skills") }))
    );
    const unlistAllowed = finder !== "foreign";
    let disabled = 0;
    let reenabled = 0;
    let foreign = 0;
    for (const anchor2 of roots) {
      const skillsDir = path20.join(anchor2, "skills");
      const here = fs21.readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== FINDER_NAME && fs21.existsSync(path20.join(skillsDir, d.name, "SKILL.md"))).map((d) => d.name);
      const nonResident = unlistAllowed ? here.filter((n) => !resident.has(n) || firstRootOf.get(n) !== anchor2) : [];
      const res = ensureCodexResidentSet(anchor2, recordPath(anchor2), nonResident);
      disabled += res.disabled.length;
      reenabled += res.reenabled.length;
      foreign += res.skipped_foreign.length;
    }
    report(
      `codex: resident set across ${roots.length} root(s) \u2014 ${split.resident.length} listed (${split.listingChars} of ${split.budgetChars} chars), ${disabled} newly unlisted, ${reenabled} relisted` + (foreign > 0 ? `, ${foreign} existing policy file(s) untouched` : "") + `, finder ${finder}` + (unlistAllowed ? "" : " \u2014 nothing unlisted, because no finder could route to it")
    );
  } catch (e) {
    report(`codex: resident set skipped \u2014 ${String(e)}`);
  }
}

// src/scripts/_lib/skill_listing_overrides.ts
var OVERRIDE_KEY = "skillOverrides";
var NAME_ONLY = "name-only";
var RECORD_BASENAME = "skill-overrides.json";
function recordPath2(env) {
  return write_target(RECORD_BASENAME, { env: env ?? null });
}
function ownedSkillNames(currentFiles) {
  const out = /* @__PURE__ */ new Set();
  for (const rel of currentFiles) {
    const m = /^skills\/([^/]+)\/SKILL\.md$/.exec(rel.split(path21.sep).join("/"));
    if (m) out.add(m[1]);
  }
  return [...out].sort();
}
function ownedCatalogue2(skillsDir, owned) {
  const out = [];
  for (const name of owned) {
    let raw;
    try {
      raw = fs22.readFileSync(path21.join(skillsDir, name, "SKILL.md"), "utf8");
    } catch {
      continue;
    }
    const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
    const line = fm ? /^description:[ \t]*(.*)$/m.exec(fm[1]) : null;
    out.push({ name, descriptionChars: line ? line[1].replace(/^["']|["']$/g, "").length : 0 });
  }
  return out;
}
function computeOverrides(skillsDir, owned) {
  const catalogue = ownedCatalogue2(skillsDir, owned);
  const { bare } = modelListingBudget(catalogue, { contextWindowTokens: 2e5 });
  const out = {};
  for (const name of bare) out[name] = NAME_ONLY;
  return out;
}
function loadRecord2(file, settingsPath) {
  const empty = { schema_version: 1, settings_path: settingsPath, created_key: false, entries: {} };
  let data;
  try {
    data = JSON.parse(fs22.readFileSync(file, "utf-8"));
  } catch {
    return empty;
  }
  const r = data;
  if (!r || typeof r !== "object" || typeof r.entries !== "object" || r.entries === null) return empty;
  if (path21.resolve(String(r.settings_path)) !== path21.resolve(settingsPath)) return empty;
  const entries = {};
  for (const [k, v] of Object.entries(r.entries)) if (typeof v === "string") entries[k] = v;
  return { schema_version: 1, settings_path: settingsPath, created_key: r.created_key === true, entries };
}
function saveRecord2(file, rec) {
  if (Object.keys(rec.entries).length === 0) {
    fs22.rmSync(file, { force: true });
    return;
  }
  fs22.mkdirSync(path21.dirname(file), { recursive: true });
  atomicWriteFile(file, `${JSON.stringify({ ...rec, entries: sortKeys(rec.entries) }, null, 2)}
`);
}
function sortKeys(o) {
  return Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
}
function overridesOf(settings) {
  const raw = settings[OVERRIDE_KEY];
  if (raw === void 0) return void 0;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  return raw;
}
function ensureListingOverrides(settingsPath, recordFile, wanted) {
  return _with_lock(settingsPath, () => {
    const settings = _read_settings(settingsPath);
    const rec = loadRecord2(recordFile, settingsPath);
    const existing = overridesOf(settings);
    const result = { changed: false, written: [], removed: [], skipped_user: [] };
    if (existing === null) {
      result.skipped_user.push(...Object.keys(wanted).sort());
      return result;
    }
    const overrides = { ...existing ?? {} };
    const next = {};
    for (const [name, value] of Object.entries(rec.entries)) {
      if (overrides[name] !== value) continue;
      const want = wanted[name];
      if (want === void 0) {
        delete overrides[name];
        result.removed.push(name);
      } else {
        if (want !== value) {
          overrides[name] = want;
          result.written.push(name);
        }
        next[name] = want;
      }
    }
    for (const [name, value] of Object.entries(wanted)) {
      if (name in next) continue;
      if (name in overrides) {
        result.skipped_user.push(name);
        continue;
      }
      overrides[name] = value;
      next[name] = value;
      result.written.push(name);
    }
    const createdKey = rec.created_key || existing === void 0 && Object.keys(next).length > 0;
    if (Object.keys(overrides).length === 0 && createdKey) delete settings[OVERRIDE_KEY];
    else if (existing !== void 0 || Object.keys(overrides).length > 0) settings[OVERRIDE_KEY] = overrides;
    result.changed = result.written.length + result.removed.length > 0;
    if (result.changed) atomicWriteFile(settingsPath, `${JSON.stringify(settings, null, 2)}
`);
    saveRecord2(recordFile, { schema_version: 1, settings_path: settingsPath, created_key: createdKey, entries: next });
    result.written.sort();
    result.removed.sort();
    result.skipped_user.sort();
    return result;
  });
}
function applyListingOverrides(anchor2, report) {
  try {
    const owned = ownedSkillNames(recorded_rel_files("claude-code", anchor2));
    const wanted = computeOverrides(path21.join(anchor2, "skills"), owned);
    const res = ensureListingOverrides(path21.join(anchor2, "settings.json"), recordPath2(), wanted);
    if (res.changed) {
      report(
        `claude-code: listing override in ~/.claude/settings.json \u2014 ${res.written.length} set name-only, ${res.removed.length} removed`
      );
    }
    if (res.skipped_user.length > 0) {
      report(
        `claude-code: listing override left ${res.skipped_user.length} user value(s) untouched (${res.skipped_user.slice(0, 5).join(", ")}${res.skipped_user.length > 5 ? ", \u2026" : ""})`
      );
    }
  } catch (e) {
    report(`claude-code: listing override skipped \u2014 ${String(e)}`);
  }
}
function applyHostListingPolicies(deployed, home, claudeAnchor, report) {
  if (deployed.claudeCode) applyListingOverrides(claudeAnchor, report);
  if (deployed.codex) applyCodexResidentSet(home, report);
}

// src/scripts/hooks/host_lowering.ts
var import_yaml2 = __toESM(require_dist(), 1);
import * as fs23 from "node:fs";
import * as path22 from "node:path";
import { fileURLToPath as fileURLToPath3 } from "node:url";

// src/scripts/hooks/table_fingerprint.ts
import { createHash as createHash8 } from "node:crypto";
function tableFingerprint(text) {
  const digest = createHash8("sha256").update(text, "utf-8").digest("hex");
  return `${digest}:${String(text.length)}`;
}

// src/scripts/hooks/host_lowering.ts
var _IN_BUNDLE = true;
var _REPO_ROOT = path22.resolve(
  path22.dirname(fileURLToPath3(import.meta.url)),
  ..._IN_BUNDLE ? ["..", ".."] : ["..", "..", ".."]
);
var HOST_LOWERING_PATH = path22.join(_REPO_ROOT, "src", "scripts", "hooks", "host_lowering.yaml");
var HOST_LOWERING_JSON_PATH = path22.join(_REPO_ROOT, "src", "scripts", "hooks", "host_lowering.json");
var DEFAULT_SURFACE = "any";
function _asString(v) {
  if (v === null || v === void 0) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}
function _parse(text) {
  return _structure((0, import_yaml2.parse)(text));
}
function _structure(raw) {
  const hostsRaw = raw?.["hosts"];
  if (typeof hostsRaw !== "object" || hostsRaw === null) {
    throw new Error("host_lowering.yaml: missing `hosts:` map");
  }
  const out = /* @__PURE__ */ new Map();
  for (const [host, hv] of Object.entries(hostsRaw)) {
    const surfacesRaw = hv?.["surfaces"];
    if (typeof surfacesRaw !== "object" || surfacesRaw === null) {
      throw new Error(`host_lowering.yaml: ${host} has no \`surfaces:\` map`);
    }
    const surfaces = /* @__PURE__ */ new Map();
    for (const [surface, sv] of Object.entries(surfacesRaw)) {
      const s = sv;
      const verifiedRaw = s["verified"];
      let verified = null;
      if (verifiedRaw) {
        const expires = _asString(verifiedRaw["expires"]);
        if (!expires) {
          throw new Error(`host_lowering.yaml: ${host}/${surface} verified block has no \`expires\``);
        }
        verified = {
          docs_at: _asString(verifiedRaw["docs_at"]),
          docs_url: _asString(verifiedRaw["docs_url"]),
          docs_digest: _asString(verifiedRaw["docs_digest"]),
          probe_at: _asString(verifiedRaw["probe_at"]),
          host_version: _asString(verifiedRaw["host_version"]),
          expires
        };
      }
      const slots = /* @__PURE__ */ new Map();
      for (const [slot, rvRaw] of Object.entries(s["slots"] ?? {})) {
        const rv = rvRaw;
        const nativeRaw = rv["native"];
        const native = Array.isArray(nativeRaw) ? nativeRaw.map(String) : [String(nativeRaw)];
        const be = rv["block_exit"];
        const row = {
          native,
          block_exit: typeof be === "number" ? be : null,
          answered_at: _asString(rv["answered_at"]),
          docs_url: _asString(rv["docs_url"])
        };
        if (typeof rv["matcher"] === "string") row.matcher = rv["matcher"];
        slots.set(slot, row);
      }
      surfaces.set(surface, {
        entry_shape: String(s["entry_shape"] ?? "none"),
        json_shape: String(s["json_shape"] ?? "none"),
        fail_policy: String(s["fail_policy"] ?? "discard"),
        timeout_unit: String(s["timeout_unit"] ?? "unknown"),
        timeout_default: typeof s["timeout_default"] === "number" ? s["timeout_default"] : null,
        verified,
        slots
      });
    }
    out.set(host, surfaces);
  }
  return out;
}
var _cache = null;
function loadHostLowering() {
  if (_cache !== null) return _cache;
  const text = fs23.readFileSync(HOST_LOWERING_PATH, "utf-8");
  let compiled;
  try {
    compiled = fs23.readFileSync(HOST_LOWERING_JSON_PATH, "utf-8");
  } catch {
    compiled = null;
  }
  _cache = resolveTable(text, compiled);
  return _cache;
}
function resolveTable(yamlText, compiledText) {
  if (compiledText !== null) {
    try {
      const raw = JSON.parse(compiledText);
      const table = raw["table"];
      if (raw["fingerprint"] === tableFingerprint(yamlText) && typeof table === "object" && table !== null && // road-to-blocking-severities 2.3 — the BODY, not only its
      // label. `fingerprint` above says the file was compiled from
      // the YAML as it stands; it says nothing about whether the
      // body underneath was edited afterwards, and an edited body
      // with an untouched label was served. `body_fingerprint` is
      // the fingerprint of the exact bytes the compiler emitted, so
      // re-stringifying what we just parsed recovers them.
      //
      // A compiled file WITHOUT the field — one written before 2.3 —
      // falls through here, which is slow and correct: accepting it
      // would make the check optional and therefore absent.
      //
      // What it covers is a partial edit, never an author: anyone
      // who edits the body can recompute this as easily as the
      // compiler. The deny in `block_plumbing_writes` and the
      // ratification record are the mechanisms aimed at an author;
      // this one is aimed at a mistake.
      raw["body_fingerprint"] === tableFingerprint(JSON.stringify(table))) {
        return _structure(table);
      }
    } catch {
    }
  }
  return _parse(yamlText);
}
function surfaceRow(host, surface = DEFAULT_SURFACE, table = loadHostLowering()) {
  return table.get(host)?.get(surface) ?? table.get(host)?.get(DEFAULT_SURFACE) ?? null;
}
function hostBindings(host, table = loadHostLowering()) {
  const row = surfaceRow(host, DEFAULT_SURFACE, table);
  if (!row) return [];
  const out = [];
  for (const [slot, sr] of row.slots) {
    for (const native of sr.native) {
      out.push({ slot, native, matcher: sr.matcher ?? "" });
    }
  }
  return out;
}

// src/scripts/_lib/agent_settings.ts
import { createRequire as createRequire2 } from "node:module";
import * as fs25 from "node:fs";
import * as os8 from "node:os";
import * as path24 from "node:path";

// src/scripts/_lib/package_root.ts
import * as fs24 from "node:fs";
import * as path23 from "node:path";
import { fileURLToPath as fileURLToPath4 } from "node:url";
var PACKAGE_NAME = "@event4u/agent-config";
var MAX_ASCENT = 16;
function resolvePackageRoot(fromUrlOrPath, legacyHops = 3) {
  const start = fromUrlOrPath.startsWith("file:") ? fileURLToPath4(fromUrlOrPath) : fromUrlOrPath;
  const startDir = path23.dirname(start);
  let dir = startDir;
  for (let i = 0; i < MAX_ASCENT; i++) {
    const manifest = path23.join(dir, "package.json");
    if (fs24.existsSync(manifest)) {
      try {
        const parsed = JSON.parse(fs24.readFileSync(manifest, "utf8"));
        if (parsed.name === PACKAGE_NAME) {
          return dir;
        }
      } catch {
      }
    }
    const parent = path23.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return path23.resolve(startDir, ...Array.from({ length: legacyHops }, () => ".."));
}

// src/shared/settingsCarveOut.ts
var SETTINGS_CARVE_OUT = [
  {
    key: "projection.mode",
    reader: "src/scripts/install.ts:3409 _resolve_scoped_projection",
    absentResolvesTo: "legacy-all",
    reason: "The template fallback applies only when NO global settings file exists. Once a file exists, an absent key means legacy-all by documented contract, so an existing install is never silently narrowed on upgrade."
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

// src/scripts/_lib/settings_renamed_keys.ts
var SETTINGS_REMOVAL_RULE = "A settings key may be removed or renamed in a minor release only when no consumer project can rely on it \u2014 default-neutral and derivable, proven by a named test; any other removal or rename ships only in a major, and a renamed key's alias is dropped only in a major.";
var RENAMED_KEYS = /* @__PURE__ */ new Map([
  ["planning.challenge_on_create", "planning.closure_pass"]
]);
var _warned = /* @__PURE__ */ new Set();
function _read(tree, dotted) {
  let cur = tree;
  for (const part of dotted.split(".")) {
    if (cur === null || typeof cur !== "object" || Array.isArray(cur)) return void 0;
    cur = cur[part];
  }
  return cur;
}
function _write(tree, dotted, value) {
  const parts = dotted.split(".");
  let cur = tree;
  for (const part of parts.slice(0, -1)) {
    const next = cur[part];
    if (next === null || typeof next !== "object" || Array.isArray(next)) cur[part] = {};
    cur = cur[part];
  }
  cur[parts[parts.length - 1]] = value;
}
function applyRenamedKeys(layer) {
  for (const [oldKey, newKey] of RENAMED_KEYS) {
    const oldValue = _read(layer, oldKey);
    if (oldValue === void 0) continue;
    if (_read(layer, newKey) === void 0) _write(layer, newKey, oldValue);
    if (_warned.has(oldKey)) continue;
    _warned.add(oldKey);
    process.stderr.write(
      `\u26A0\uFE0F  settings: \`${oldKey}\` was renamed to \`${newKey}\`; the old key still works. ${SETTINGS_REMOVAL_RULE} Rename it in your .agent-settings.yml.
`
    );
  }
  return layer;
}

// src/scripts/_lib/settings_removed_keys.ts
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
  ["telegraph.speak_scope", "the rule body states its own scope; compile_time_toggles decides whether the rule ships"],
  ["chat_history.max_size_kb", "the rotate command takes --max-kb from argv; session-count pruning bounds the file"],
  ["chat_history.on_overflow", "the overflow mode comes from the rotate command --mode argv"],
  ["quality.wait_for_remote_ci", "whether to poll follows from the push plus a detectable remote pipeline"],
  ["legal_review_prep.consented_at", "the provenance sidecar settings:set writes and consentVerdict reads"],
  ["worktrees.mode", "the user asking for a worktree in the chat; creation is instruction-only and hardcoded"],
  // 2026-10-09 — output and tone
  ["personal.minimal_output", "direct-answers Iron Law 3 mandates terse replies; there is no verbose mode"],
  ["personal.play_by_play", "direct-answers: no narration unless the user asks for it in the turn"],
  ["personal.pr_comment_bot_icon", "no-decorative-emojis-in-git-surfaces forbids the \u{1F916} prefix"],
  ["verbosity.intent_announcements", 'direct-answers: act and emit the result, no "Let me\u2026" openers'],
  ["verbosity.preview_artifacts", "generated content is used directly; preview-on-error and the Iron-Law gates decide when a preview shows"],
  ["verbosity.routine_confirmations", "the no-cheap-questions Pre-Send Self-Check; Iron-Law gates always ask"],
  ["verbosity.post_action_reports", "direct-answers Iron Law 3: a one-line confirmation and one end-summary"],
  ["telegraph.speak", "the telegraph-speak predicate in compile_time_toggles.ts; the bench verdict is package-level (ADR telegraph/0002)"],
  ["tokens.rich_skills", "the skill's own token_budget_class: rich plus the lint_token_budget_discipline ceiling"],
  // 2026-10-09 — reasoning protocol switches
  ["reasoning.auto_gate", "the RDP gate task signal plus the host self-assessment in rdp-gate.md"],
  ["reasoning.components.orchestrator", "the RDP gate task and host signals decide per component; reasoning.enabled stays the hard off"],
  ["reasoning.components.notes_first", "the RDP gate task and host signals decide per component; reasoning.enabled stays the hard off"],
  ["reasoning.components.grounding", "the RDP gate task and host signals decide per component; reasoning.enabled stays the hard off"],
  ["reasoning.components.intent", "the RDP gate task and host signals decide per component; reasoning.enabled stays the hard off"],
  ["reasoning.components.complexity_first", "the RDP gate task and host signals decide per component; reasoning.enabled stays the hard off"],
  ["reasoning.components.verifier_default", "the RDP gate task and host signals decide per component; reasoning.enabled stays the hard off"],
  ["reasoning.components.prediction_tracking", "the RDP gate task and host signals decide per component; reasoning.enabled stays the hard off"],
  ["reasoning.components.decision_ledger", "the RDP gate task and host signals decide per component; reasoning.enabled stays the hard off"],
  ["reasoning.components.uncertainty_budget", "the RDP gate task and host signals decide per component; reasoning.enabled stays the hard off"],
  // 2026-10-09 — roadmap cadence
  ["roadmap.skip_pre_run_gate", "the command name names the scope; only an ambiguous roadmap or an unresolvable conflict shows the gate"],
  ["roadmap.dashboard_regen_cadence", "a fixed cadence: every 5th closed step, every phase boundary, reply end and any file-shape touch"],
  // 2026-10-09 — command suggestion and PR creation
  ["commands.auto_detect", "an orchestrator's own auto_detect front-matter and the --no-auto-detect flag"],
  ["commands.suggestion.enabled", "the suggester match-score floor and cooldown; /command-suggestion-off silences one conversation"],
  ["commands.suggestion.confidence_floor", "the suggester's fixed 0.6 floor; a command's own suggestion frontmatter can tighten it"],
  ["commands.suggestion.cooldown_seconds", "the suggester's fixed 600-second cooldown; a command's own suggestion frontmatter can lengthen it"],
  ["commands.suggestion.max_options", "the fixed cap of 4 suggestions plus the always-present as-is option"],
  ["commands.create_pr.api_examples", "/create-pr's grounding rule: an example only from a real source, otherwise a one-line pointer"],
  ["commands.create_pr.ui_paths", "/create-pr's light frontend heuristic, which fails open"],
  ["commands.create_pr.api_paths", "/create-pr's light API-endpoint heuristic, which fails open"],
  // 2026-10-09 — memory and knowledge sharing
  ["memory.cadence", "a fixed cadence: the memory line renders whenever a memory type was asked; memory.visibility: off still silences it"],
  ["memory.review_threshold", "/memory load's fixed preview threshold of 10 unreviewed intake signals"],
  ["knowledge.global_sharing.redaction.enabled", "the write-time redaction scan, which always runs before a card goes global"],
  ["knowledge.global_sharing.redaction.halt_on_trigger", "the redaction gate, which always halts on a confidential-pattern hit"],
  ["knowledge.global_sharing.auto_promote_threshold", "the fixed two-repo sighting count that triggers a promotion suggestion"],
  ["knowledge.global_sharing.freshness.hypothesis_after_days", "the card's age over last_verified against the fixed 90-day lead-only window"],
  ["knowledge.global_sharing.freshness.stale_after_days", "the card's age over last_verified against the fixed 180-day skip window"],
  // 2026-10-09 — hooks and engine
  ["hooks.concern_budget.max_per_event", "the concern-budget gate's own constant of 8 per (platform, event) cell"],
  ["hooks.concern_budget.hard_fail", "the concern-budget gate's --strict argv; without it the gate warns"],
  ["decision_engine.surface_traces", "nothing: the per-phase decision trace stays off, the old default"],
  ["decision_engine.on_block_fallback", "the fail-safe: an on_block ask that times out always stops"],
  ["explain.enable_last", "the presence of a work-state trace; explain last always renders it"],
  // 2026-10-09 — remaining
  ["project.pr_template", "/create-pr, which reads .github/pull_request_template.md"],
  ["pipelines.skill_improvement", "the skill-improvement-trigger rule; the capture is a proposal the user confirms"],
  ["consistency.cross_source", "the cross-source-consistency rule, always on; batching and the no-cheap-questions floor bound the noise"],
  ["subagents.downshift", "the model_tier each sub-task declares; downshift is always on"],
  ["ai_team.suppress_setup_hint", "nothing: the one-line team-mode setup hint is always shown"],
  // 2026-10-20 — the projection keys (ADR-293, road-to-a-setup-that-decides-itself Phase 4)
  ["lean_projection.mode", "the computed layer-form decision (_lib/layer_form_decision.ts), plus `install --full` and src/config/layer-form-brakes.json as the two brakes. For one release window an installer converts a leftover `eager-all` into the install receipt pin and drops any other value, saying which (_lib/projection_key_migration.ts); the project tree reads the package-owned src/config/project-tree-form.json, never this key"],
  ["lean_projection.hosts", "THINNABLE_HOSTS in _lib/lean_projection_mode.ts and the per-host row in src/config/host-injection-effect.json; no reader of this key remains"],
  ["projection.rule_workspaces", "consumerRuleWorkspaces() in _lib/scoped_projection.ts, which derives the consumer workspace set from src/config/discovery/packs.yml \u2014 every id minus `agent-config-maintainer` \u2014 so a new pack reaches consumers without a settings edit"]
]);
var _warnedRemovedKeys = /* @__PURE__ */ new Set();
function _readDotted(root, dotted) {
  let node2 = root;
  for (const part of dotted.split(".")) {
    if (typeof node2 !== "object" || node2 === null || Array.isArray(node2)) {
      return void 0;
    }
    node2 = node2[part];
  }
  return node2;
}
function warnRemovedKeys(merged) {
  for (const [key, reason] of REMOVED_KEYS) {
    if (_warnedRemovedKeys.has(key)) {
      continue;
    }
    if (_readDotted(merged, key) === void 0) {
      continue;
    }
    _warnedRemovedKeys.add(key);
    process.stderr.write(`${key} was removed (${reason}); ignored.
`);
  }
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
  return path24.join(project_root, ...LOCAL_PROJECT_SUBDIR, LOCAL_PROJECT_FILE);
}
function _canonical_settings_path(project_root) {
  return path24.join(project_root, ...LOCAL_PROJECT_SUBDIR, DEFAULT_PROJECT_FILE);
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
  // `name` and `ide` are the PRE-MIGRATION spellings. `install.ts` migrates
  // `ide` → `personal.ide`, and this list was never moved with it — so the
  // whitelist named a key the template does not have while the key it does
  // have was filtered out silently (road-to-capability-answerability 4.3,
  // ADR-219). `personal.bot_icon` / `personal.pr_comment_bot_icon` left with
  // the key itself (2026-10-09): a whitelisted key nothing reads would carry a
  // user-global value into a tree that ignores it.
  //
  // Both spellings are listed rather than replaced: a legacy file that still
  // uses the old name keeps working, and nothing that resolved before
  // resolves differently. `name` has no reader anywhere and no template key;
  // it is kept only so this change stays purely additive.
  "name",
  "ide",
  "personal.ide",
  "rule_loading_tier",
  "personal.autonomy",
  // Knowledge-card global cross-project sharing is a USER-GLOBAL setting
  // (ADR-100 / road-to-structure-grounding-v2). Whitelisted so the
  // ~/.event4u/agent-config/agent-settings.yml values are honoured.
  "knowledge.global_sharing.enabled",
  "knowledge.global_sharing.allowed_tiers",
  // `design.fidelity_mode` is a per-DEVELOPER working preference, not a
  // per-project one: whether an agent may deviate from a handed-over design
  // is a property of how that person works, and a designer who sets it once
  // expects it in every checkout. `design-fidelity.md` already tells the
  // reader to resolve it through the cascade — "that file is the project
  // layer of a cascade that starts user-global" — and the cascade then
  // filtered it out here, silently, so the rule's own instruction could not
  // be followed. Class C, so a user still sets it by hand or through the
  // GUI; whitelisting decides only whether the value SURVIVES the merge
  // (ADR-271, road-to-design-intent-conformance 2.3).
  "design.fidelity_mode",
  // `retro.enabled` is the one switch over the automatic retro (ADR-292). It
  // ships `true`, so the only value worth writing is `false`, and a user who
  // writes it once in the user-global file expects every checkout without its
  // own value to honour it — without this row the off switch would be
  // discarded silently. A project value still wins.
  "retro.enabled"
];
var TEMPLATE_RELATIVE = path24.join("src", "config", "agent-settings.template.yml");
var _PACKAGE_ROOT = resolvePackageRoot(import.meta.url);
function default_template_path() {
  return path24.join(_PACKAGE_ROOT, TEMPLATE_RELATIVE);
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
    fs25.lstatSync(p);
    fs25.statSync(p);
    return true;
  } catch {
    return false;
  }
}
function _is_dir2(p) {
  try {
    return fs25.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
function _is_file(p) {
  try {
    return fs25.statSync(p).isFile();
  } catch {
    return false;
  }
}
function _resolve(p) {
  const absolute = path24.resolve(p);
  try {
    return fs25.realpathSync(absolute);
  } catch {
    return absolute;
  }
}
function _ancestor_chain(start) {
  const chain = [];
  let cursor = start;
  for (; ; ) {
    chain.push(cursor);
    const parent = path24.dirname(cursor);
    if (parent === cursor) {
      break;
    }
    cursor = parent;
  }
  return chain;
}
function _boundary_anchor_at(dir) {
  const agents_dir = path24.join(dir, "agents");
  if (_is_dir2(agents_dir)) {
    for (const marker of _AGENTS_DIR_MARKERS) {
      if (_exists(path24.join(agents_dir, marker))) {
        return ANCHOR_AGENTS_DIR;
      }
    }
  }
  if (_exists(path24.join(dir, ".git"))) {
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
      if (_exists(path24.join(candidate, ".git"))) {
        return [candidate, ANCHOR_GIT];
      }
    }
    return null;
  }
  for (const candidate of chain) {
    const anchor2 = _boundary_anchor_at(candidate);
    if (anchor2 !== null) {
      return [candidate, anchor2];
    }
  }
  let outermost = null;
  for (const candidate of chain) {
    if (_exists(path24.join(candidate, DEFAULT_PROJECT_FILE))) {
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
    return os8.homedir();
  }
  if (p.startsWith("~/") || process.platform === "win32" && p.startsWith("~\\")) {
    return path24.join(os8.homedir(), p.slice(2));
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
    const parent = path24.dirname(legacy);
    return [legacy, _canonical_settings_path(parent), _local_settings_path(parent)];
  }
  const root = find_project_root(cwd);
  if (root === null) {
    const legacy = project_path ? project_path : DEFAULT_PROJECT_FILE;
    const parent = path24.dirname(legacy);
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
    const parent = path24.dirname(cursor);
    if (parent === cursor) {
      break;
    }
    cursor = parent;
  }
  chain.reverse();
  return [
    ...chain.map((d) => path24.join(d, DEFAULT_PROJECT_FILE)),
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
  _deep_merge(merged, applyRenamedKeys(user_global_filtered));
  for (const p of cascade) {
    const layer = applyRenamedKeys(_read_yaml(p) ?? {});
    if (Object.keys(layer).length > 0) {
      _deep_merge(merged, layer);
    }
  }
  warnRemovedKeys(merged);
  return merged;
}
function _read_yaml(p) {
  if (!_is_file(p)) {
    return null;
  }
  let YAML6;
  try {
    YAML6 = _require2("yaml");
  } catch {
    return null;
  }
  let data;
  try {
    const text = fs25.readFileSync(p, "utf-8");
    data = YAML6.parse(text, { version: "1.1" });
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

// src/scripts/_lib/projection_key_migration.ts
var MIGRATION_WINDOW = "one release window after the 2026-10 key removal";
var LEGACY_FULL_VALUE = Object.freeze({
  "lean_projection.mode": "eager-all",
  "projection.mode": "legacy-all"
});
function readDotted(root, dotted) {
  let node2 = root;
  for (const part of dotted.split(".")) {
    if (typeof node2 !== "object" || node2 === null || Array.isArray(node2)) return void 0;
    node2 = node2[part];
  }
  return node2;
}
function readLegacyProjectionIntent(merged) {
  const rows = [];
  let pin = false;
  for (const [key, full] of Object.entries(LEGACY_FULL_VALUE)) {
    const raw = readDotted(merged, key);
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (value === "") continue;
    const disposition = value.toLowerCase() === full ? "pin" : "dropped";
    if (disposition === "pin") pin = true;
    rows.push({ key, value, disposition });
  }
  return { pin, rows };
}
function migrationLines(intent) {
  return intent.rows.map(
    (row) => row.disposition === "pin" ? `${row.key}: "${row.value}" was removed (ADR-293); read once as a request to keep the rule layer full, and kept as the install receipt's pin \u2014 ${MIGRATION_WINDOW}.` : `${row.key}: "${row.value}" was removed (ADR-293); ignored \u2014 the package decides the layer form from machine evidence, and \`doctor --check layer-form\` says which form it chose and why \u2014 ${MIGRATION_WINDOW}.`
  );
}
function legacyProjectionPin(merged, emit) {
  if (merged === null) return false;
  const intent = readLegacyProjectionIntent(merged);
  for (const line of migrationLines(intent)) emit(line);
  return intent.pin;
}

// src/install/rule_scope.ts
import * as path25 from "node:path";

// src/install/ruleInScope.ts
var YAML5 = __toESM(require_dist(), 1);
import * as fs26 from "node:fs";
function parseYaml3(text) {
  try {
    const data = YAML5.parse(text, { version: "1.1" });
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
  let meta2 = parseYaml3(raw);
  if (meta2 === null || meta2 === void 0) {
    meta2 = {};
  }
  if (typeof meta2 === "object" && meta2 !== null && !Array.isArray(meta2)) {
    return [meta2, body];
  }
  return [{}, body];
}
function rule_in_scope(source_path, scope, pack_scope = null, role_scope = null) {
  if (scope === null && pack_scope === null && role_scope === null) {
    return true;
  }
  const [meta2] = parseFrontmatter(fs26.readFileSync(source_path, "utf-8"));
  if (meta2["type"] === "always" || meta2["alwaysApply"] === true) {
    return true;
  }
  const axis = (key, configured) => {
    if (configured === null) {
      return true;
    }
    const values = Array.isArray(meta2[key]) ? meta2[key].map((w) => String(w)) : [];
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
  const derivedWorkspaces = packageRoot === void 0 ? null : consumerRuleWorkspaces(packageRoot);
  const proj = settings["projection"];
  if (typeof proj !== "object" || proj === null || Array.isArray(proj)) {
    return { ...LEGACY_ALL, workspaces: derivedWorkspaces };
  }
  const p = proj;
  const packs = packageRoot === void 0 ? _list(p["rule_packs"]) : resolve_rule_pack_scope(
    p["rule_packs"],
    packageRoot,
    _list(_runtimeActivePacks(settings)) ?? []
  );
  return {
    // DERIVED since ADR-293 step 4.6, not read. `projection.rule_workspaces`
    // carried this list as a settings default — the nine consumer workspace
    // ids, re-typed into the template and needing a re-type whenever a pack
    // arrived with a new one. What it encoded is a RULE: maintainer-only
    // rules never project to a consumer. `consumerRuleWorkspaces` derives
    // exactly that from the pack vocabulary, and the derived set equals the
    // old default (asserted in `consumer_rule_workspaces.test.ts`).
    // Without a package root there is no vocabulary to read, so the axis is
    // INACTIVE rather than empty — the same degradation `rule_packs` makes
    // above, and the same reason: a package that cannot read its own pack
    // list must ship more than it should, never less.
    workspaces: derivedWorkspaces,
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
  const basename10 = path25.basename(sourcePath);
  if (COMPAT_ALWAYS_EXCLUDED.includes(basename10)) {
    return false;
  }
  return rule_in_scope(sourcePath, scope.workspaces, scope.packs, scope.roles ?? null);
}

// src/install/partitionEligibility.ts
import * as fs28 from "node:fs";
import * as os9 from "node:os";

// src/install/hostLayerFingerprint.ts
import { createHash as createHash9 } from "node:crypto";
import * as fs27 from "node:fs";
import * as path26 from "node:path";
var FINGERPRINT_SCHEMA = 1;
function collectFiles(dir) {
  const out = [];
  const walk = (d) => {
    let entries;
    try {
      entries = fs27.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    const sorted = [...entries].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    for (const e of sorted) {
      const p = path26.join(d, e.name);
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
  const h = createHash9("sha256");
  h.update(`v${FINGERPRINT_SCHEMA}\0`);
  for (const layer of layers) {
    h.update(`layer:${layer.label}\0`);
    for (const file of collectFiles(layer.root)) {
      h.update(path26.relative(layer.root, file));
      h.update("\0");
      try {
        h.update(fs27.readFileSync(file));
      } catch {
        h.update("\0unreadable\0");
      }
      h.update("\0");
    }
  }
  return h.digest("hex");
}
function hostLayerInputs(userHome) {
  const claude = path26.join(userHome, ".claude");
  return [
    { label: "rules", root: path26.join(claude, "rules") },
    { label: "skills", root: path26.join(claude, "skills") },
    { label: "commands", root: path26.join(claude, "commands") }
  ];
}

// src/install/partitionEligibility.ts
var MAINTAINER_WORKSPACE2 = "agent-config-maintainer";
function isExclusivelyPackageOnly(source_path) {
  let meta2;
  try {
    [meta2] = parseFrontmatter(fs28.readFileSync(source_path, "utf-8"));
  } catch {
    return false;
  }
  const raw = meta2["workspaces"];
  if (!Array.isArray(raw) || raw.length === 0) {
    return false;
  }
  return raw.every((w) => String(w) === MAINTAINER_WORKSPACE2);
}
function stampHostLayerFingerprint(installedVersion, tools, lockfilePath, skip2, report) {
  if (skip2) {
    return null;
  }
  try {
    const fingerprint = fingerprintLayers(hostLayerInputs(os9.homedir()));
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

// src/install/claudeRuleRewrite.ts
import * as fs29 from "node:fs";
import * as path27 from "node:path";

// src/install/claudePathsPlan.ts
function derive_trigger_globs(meta2) {
  const triggers = meta2["triggers"];
  if (!Array.isArray(triggers)) {
    return [];
  }
  const globs = [];
  for (const t of triggers) {
    if (t === null || typeof t !== "object" || Array.isArray(t)) continue;
    const obj = t;
    if (typeof obj["file_pattern"] === "string" && obj["file_pattern"]) {
      globs.push(obj["file_pattern"]);
    } else if (typeof obj["path_prefix"] === "string" && obj["path_prefix"]) {
      const prefix = obj["path_prefix"];
      globs.push(prefix.endsWith("/") ? `${prefix}**` : `${prefix}**`);
    }
  }
  return [...new Set(globs)];
}
function _is_unresolved_placeholder(pattern) {
  for (const m of pattern.matchAll(/\{([^}]*)\}/g)) {
    if (!m[1].includes(",")) {
      return true;
    }
  }
  return false;
}
function _escape_claude_bracket(pattern) {
  return pattern.replace(/\[/g, "\\[");
}
function _expanded_pattern_count(pattern) {
  let n = 1;
  for (const m of pattern.matchAll(/\{([^}]*)\}/g)) {
    n *= m[1].split(",").length;
  }
  return n;
}
var CLAUDE_PATHS_PATTERN_BUDGET = 1e3;
var PATH_SHAPED_TRIGGER_KEYS = /* @__PURE__ */ new Set(["file_pattern", "path_prefix"]);
var NON_MATCHING_TRIGGER_KEYS = /* @__PURE__ */ new Set(["reason"]);
function _has_non_path_trigger(meta2) {
  const triggers = meta2["triggers"];
  if (!Array.isArray(triggers)) return false;
  for (const t of triggers) {
    if (t === null || typeof t !== "object" || Array.isArray(t)) continue;
    const obj = t;
    for (const [key, value] of Object.entries(obj)) {
      if (PATH_SHAPED_TRIGGER_KEYS.has(key) || NON_MATCHING_TRIGGER_KEYS.has(key)) continue;
      if (typeof value === "string") {
        if (value.trim() !== "") return true;
      } else if (value !== void 0 && value !== null) {
        return true;
      }
    }
  }
  return false;
}
function _claude_paths_plan(meta2) {
  const always_apply = Boolean(meta2["alwaysApply"] || meta2["type"] === "always");
  if (always_apply) {
    return { globs: [], dropped: [] };
  }
  const globs = [];
  const dropped = [];
  if (_has_non_path_trigger(meta2)) {
    for (const raw of derive_trigger_globs(meta2)) {
      dropped.push({ pattern: raw, reason: "mixed-triggers" });
    }
    return { globs, dropped };
  }
  let spent = 0;
  for (const raw of derive_trigger_globs(meta2)) {
    if (_is_unresolved_placeholder(raw)) {
      dropped.push({ pattern: raw, reason: "unresolved-placeholder" });
      continue;
    }
    const cost = _expanded_pattern_count(raw);
    if (spent + cost > CLAUDE_PATHS_PATTERN_BUDGET) {
      dropped.push({ pattern: raw, reason: "over-budget" });
      continue;
    }
    spent += cost;
    globs.push(_escape_claude_bracket(raw));
  }
  return { globs, dropped };
}

// src/install/claudeRuleRewrite.ts
var PRESERVED_KEYS = ["package", "source_path"];
function _withPreservedKeys(rendered, original) {
  const keep = [];
  if (original.startsWith("---")) {
    const end = original.indexOf("\n---", 3);
    if (end !== -1) {
      for (const line of original.slice(3, end).split("\n")) {
        if (PRESERVED_KEYS.some((k) => line.startsWith(`${k}:`))) keep.push(line);
      }
    }
  }
  if (keep.length === 0) return rendered;
  if (rendered.startsWith("---\n")) {
    const end = rendered.indexOf("\n---", 3);
    if (end !== -1) {
      return rendered.slice(0, end) + "\n" + keep.join("\n") + rendered.slice(end);
    }
  }
  return ["---", ...keep, "---", "", rendered].join("\n");
}
function rewriteAndReport(rulesDir, quiet, info2, warn2, wrappers, preserved = /* @__PURE__ */ new Set(), onWrite) {
  const result = rewriteClaudeRules(rulesDir, preserved, onWrite);
  if (wrappers && !quiet) {
    if (wrappers.wrapped.length > 0) {
      info2(
        `  claude-code: ${wrappers.wrapped.length} visible flat command(s) projected as skill wrappers (Claude Code flat-command discovery workaround)`
      );
    }
    if (wrappers.reserved.length > 0) {
      info2(
        `  claude-code: ${wrappers.reserved.length} flat command(s) withheld \u2014 name is a Claude Code built-in (${wrappers.reserved.join(", ")}); nested /cluster:sub commands remain available`
      );
    }
    if (wrappers.foreign !== void 0 && wrappers.foreign.length > 0) {
      info2(
        `  claude-code: kept ${wrappers.foreign.length} neighbour command file(s) whose name is a Claude Code built-in (${wrappers.foreign.join(", ")}); not ours to remove`
      );
    }
  }
  if (result.rewritten > 0 && !quiet) {
    info2(
      `  claude-code: ${result.rewritten} rule(s) rewritten to host form; ${result.scoped.length} path-scoped (${result.scoped.join(", ") || "none"})`
    );
  }
  if (result.dropped.length > 0 && !quiet) {
    const rules = [...new Set(result.dropped.map((d) => d.rule))];
    info2(
      `  claude-code: ${rules.length} rule(s) keep unconditional activation (mixed path + keyword triggers; \`paths:\` is exclusive on this host)`
    );
  }
  for (const f of result.failed) {
    warn2(`  claude-code: ${f.rule}: could not write host form \u2014 ${f.reason}`);
  }
  return result;
}
function pyRstrip(s) {
  return s.replace(/\s+$/u, "");
}
function yamlScalar(value) {
  return JSON.stringify(value);
}
function renderClaudeRule(sourceText) {
  const [meta2, body] = parseFrontmatter(sourceText);
  const plan = _claude_paths_plan(meta2);
  const lines = [];
  if (plan.globs.length > 0) {
    lines.push("---", "paths:");
    for (const g of plan.globs) {
      lines.push(`  - ${yamlScalar(g)}`);
    }
    lines.push("---", "");
  }
  lines.push(pyRstrip(body) + "\n");
  return { text: lines.join("\n"), globs: plan.globs, dropped: plan.dropped };
}
function rewriteClaudeRules(rulesDir, preserved = /* @__PURE__ */ new Set(), onWrite) {
  const result = { rewritten: 0, scoped: [], dropped: [], failed: [] };
  let entries;
  try {
    entries = fs29.readdirSync(rulesDir);
  } catch {
    return result;
  }
  for (const name of entries.filter((n) => n.endsWith(".md")).sort()) {
    const full = path27.join(rulesDir, name);
    if (preserved.has(path27.resolve(full))) continue;
    let stat;
    try {
      stat = fs29.lstatSync(full);
    } catch {
      continue;
    }
    if (!stat.isFile() || stat.isSymbolicLink()) continue;
    let text;
    try {
      text = fs29.readFileSync(full, "utf-8");
    } catch {
      continue;
    }
    const [meta2] = parseFrontmatter(text);
    if (meta2["paths"] !== void 0 && meta2["triggers"] === void 0) continue;
    const rendered = renderClaudeRule(text);
    const withOwnership = _withPreservedKeys(rendered.text, text);
    if (withOwnership !== text) {
      try {
        fs29.writeFileSync(full, withOwnership, "utf-8");
      } catch (e) {
        result.failed.push({
          rule: name.slice(0, -3),
          reason: e instanceof Error ? e.message : String(e)
        });
        continue;
      }
      onWrite?.(full);
      result.rewritten += 1;
    }
    const stem = name.slice(0, -3);
    if (rendered.globs.length > 0) result.scoped.push(stem);
    for (const d of rendered.dropped) {
      result.dropped.push({ rule: stem, pattern: d.pattern, reason: d.reason });
    }
  }
  return result;
}

// src/install/installThinLayer.ts
import * as fs33 from "node:fs";
import * as path32 from "node:path";
import * as os12 from "node:os";

// src/scripts/_lib/installed_layer.ts
import * as fs30 from "node:fs";
import * as os11 from "node:os";
import * as path29 from "node:path";
import { fileURLToPath as fileURLToPath5 } from "node:url";

// src/install/globalRuleLayers.ts
import * as os10 from "node:os";
import * as path28 from "node:path";
var GLOBAL_RULE_DIRS = {
  "claude-code": ".claude/rules",
  cursor: ".cursor/rules",
  augment: ".augment/rules",
  // Windsurf's scope root is `~/.codeium/windsurf/`, not `~/.windsurf/`.
  windsurf: ".codeium/windsurf/rules",
  // Cline's scope root IS the rules directory — no `rules/` suffix.
  cline: "Documents/Cline/Rules"
};
function globalRuleLayerPath(toolId, home = process.env["HOME"] ?? os10.homedir()) {
  const rel = GLOBAL_RULE_DIRS[toolId];
  return rel === void 0 ? null : path28.join(home, rel);
}

// src/scripts/_lib/rule_law_section.ts
var IRON_LAW_RE = /\biron\s+laws?\b/i;
var HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;
var FENCE_RE = /^\s*```/;
function splitFrontmatter(text) {
  if (text.startsWith("---\n")) {
    const end = text.indexOf("\n---\n", 4);
    if (end !== -1) {
      return [text.slice(0, end + 5), text.slice(end + 5)];
    }
  }
  return ["", text];
}
function ruleBody(text) {
  const [, body] = splitFrontmatter(text);
  return body.replace(/<!--[\s\S]*?-->/g, "").trim();
}
function lawSections(body) {
  const lines = body.split("\n");
  let inFence = false;
  const headings = [];
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    if (FENCE_RE.test(raw)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = HEADING_RE.exec(raw);
    if (m) headings.push({ i, depth: m[1].length, title: m[2].trim() });
  }
  const out = [];
  for (let k = 0; k < headings.length; k += 1) {
    const h = headings[k];
    if (!IRON_LAW_RE.test(h.title)) continue;
    let end = lines.length;
    for (let j = k + 1; j < headings.length; j += 1) {
      const n = headings[j];
      if (n.depth <= h.depth) {
        end = n.i;
        break;
      }
    }
    out.push({
      title: h.title,
      depth: h.depth,
      line: h.i + 1,
      text: lines.slice(h.i, end).join("\n").trim()
    });
  }
  return out;
}
function lawText(body) {
  const sections = lawSections(body);
  if (sections.length === 0) return null;
  return sections.map((s) => s.text).join("\n\n");
}

// src/scripts/_lib/installed_layer_normalise.ts
var ABSOLUTE_PATH_TOKEN = "<abs>";
var POSIX_ABSOLUTE = /(?<![A-Za-z0-9._~%@+:/\\-])(?:\/[A-Za-z0-9._@+~-]+){2,}/g;
var WINDOWS_ABSOLUTE = /(?<![A-Za-z0-9._~%@+:/\\-])[A-Za-z]:(?:[\\/][A-Za-z0-9._@+~-]+)+/g;
function normaliseLayerText(text) {
  return text.replace(WINDOWS_ABSOLUTE, ABSOLUTE_PATH_TOKEN).replace(POSIX_ABSOLUTE, ABSOLUTE_PATH_TOKEN);
}

// src/scripts/_lib/installed_layer.ts
var TOP_FILES = 20;
var LIMIT_WARN_FRACTION = 0.8;
function isUnconditional(text) {
  const [frontmatter] = splitFrontmatter(text);
  const emptyBlock = /^---\n---(\n|$)/.test(text);
  if (frontmatter === "" && !emptyBlock && /^\uFEFF?[\s]*---/.test(text)) {
    return !/^paths:/m.test(text);
  }
  return !/^paths:/m.test(frontmatter);
}
function readLayer(host, scope, dir, recorded) {
  const empty = {
    files: 0,
    unconditional: 0,
    chars: 0,
    normalised_chars: 0,
    package_owned: 0,
    foreign: 0,
    package_owned_chars: 0,
    foreign_chars: 0,
    unconditional_chars: 0,
    scoped_chars: 0,
    top: []
  };
  let names;
  try {
    names = fs30.readdirSync(dir);
  } catch {
    return { host, scope, dir, present: false, ...empty };
  }
  const readings = [];
  for (const name of names.sort()) {
    if (!name.endsWith(".md")) continue;
    const abs = path29.join(dir, name);
    let text;
    try {
      const st = fs30.statSync(abs);
      if (!st.isFile()) continue;
      text = fs30.readFileSync(abs, "utf-8");
    } catch {
      continue;
    }
    const owned = recorded.has(abs);
    readings.push({
      file: name,
      // THE STRIP IS THE PROJECTOR'S OWN. `ruleBody` is what
      // `project_thin_rules` and the delivery carrier both call, so "what
      // a host loads" and "what a delivery carries" cannot drift into two
      // spellings of the same measurement.
      chars: ruleBody(text).length,
      // THE SAME STRING, MEASURED TWICE. `chars` is what the host loads;
      // this is that text with every absolute path substituted, so two
      // machines with different package roots read one figure in common.
      normalised_chars: normaliseLayerText(ruleBody(text)).length,
      unconditional: isUnconditional(text),
      package_owned: owned
    });
  }
  const top = [...readings].sort((a, b) => b.chars - a.chars || a.file.localeCompare(b.file)).slice(0, TOP_FILES);
  return {
    host,
    scope,
    dir,
    present: true,
    files: readings.length,
    unconditional: readings.filter((r) => r.unconditional).length,
    chars: readings.reduce((n, r) => n + r.chars, 0),
    normalised_chars: readings.reduce((n, r) => n + r.normalised_chars, 0),
    package_owned: readings.filter((r) => r.package_owned).length,
    foreign: readings.filter((r) => !r.package_owned).length,
    package_owned_chars: readings.reduce((n, r) => n + (r.package_owned ? r.chars : 0), 0),
    foreign_chars: readings.reduce((n, r) => n + (r.package_owned ? 0 : r.chars), 0),
    unconditional_chars: readings.reduce((n, r) => n + (r.unconditional ? r.chars : 0), 0),
    scoped_chars: readings.reduce((n, r) => n + (r.unconditional ? 0 : r.chars), 0),
    top
  };
}
function defaultHostLimitsPath() {
  return path29.join(
    path29.dirname(fileURLToPath5(import.meta.url)),
    "..",
    "..",
    "config",
    "host-instruction-limits.json"
  );
}
function loadHostInstructionLimits(file = defaultHostLimitsPath()) {
  const out = /* @__PURE__ */ new Map();
  let raw;
  try {
    raw = JSON.parse(fs30.readFileSync(file, "utf-8"));
  } catch {
    return out;
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return out;
  for (const [host, v] of Object.entries(raw)) {
    if (host.startsWith("_")) continue;
    if (typeof v !== "object" || v === null || Array.isArray(v)) continue;
    const e = v;
    const n = e.limit;
    const limit = typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
    const k = e.kind;
    const kind = limit === null ? "unpublished" : k === "vendor-published" || k === "reported" ? k : "reported";
    out.set(host, { limit, kind });
  }
  return out;
}
function buildHostLimitRows(layers, limits) {
  const byHost = /* @__PURE__ */ new Map();
  for (const l of layers) {
    if (!l.present) continue;
    const acc = byHost.get(l.host) ?? { chars: 0, owned: 0, foreign: 0 };
    acc.chars += l.chars;
    acc.owned += l.package_owned_chars;
    acc.foreign += l.foreign_chars;
    byHost.set(l.host, acc);
  }
  for (const l of layers) if (!byHost.has(l.host)) byHost.set(l.host, { chars: 0, owned: 0, foreign: 0 });
  for (const [host, e] of limits) if (e.limit !== null && !byHost.has(host)) {
    byHost.set(host, { chars: 0, owned: 0, foreign: 0 });
  }
  const rows = [];
  for (const host of [...byHost.keys()].sort()) {
    const a = byHost.get(host);
    const e = limits.get(host) ?? { limit: null, kind: "unpublished" };
    const fraction = e.limit === null ? null : a.chars / e.limit;
    rows.push({
      host,
      limit: e.limit,
      kind: e.kind,
      chars: a.chars,
      package_owned_chars: a.owned,
      foreign_chars: a.foreign,
      fraction,
      warn: fraction !== null && fraction >= LIMIT_WARN_FRACTION
    });
  }
  return rows;
}
function defaultInventoryPath(home) {
  if (home === void 0 || home === null || home === "") return inventory_path();
  try {
    const real = (q) => {
      try {
        return fs30.realpathSync(q);
      } catch {
        return path29.resolve(q);
      }
    };
    const mine = os11.homedir();
    if (path29.resolve(home) === path29.resolve(mine) || real(home) === real(mine)) {
      return inventory_path();
    }
  } catch {
  }
  return path29.join(home, DEFAULT_EVENT4U_ROOT_RELATIVE, INVENTORY_BASENAME);
}
function resolveLayerOwnership(opts) {
  const recorded = /* @__PURE__ */ new Map();
  const sources = [];
  if (opts.inventoryPath !== null) {
    let n = 0;
    try {
      const inv = load_inventory(opts.inventoryPath ?? defaultInventoryPath(opts.home));
      for (const abs of recorded_absolute_files(inv, opts.home ?? null)) {
        if (!recorded.has(abs)) n += 1;
        recorded.set(abs, null);
      }
    } catch {
    }
    if (n > 0) sources.push("global-inventory");
  }
  let fromDeploy = 0;
  for (const [anchor2, rels] of opts.thisDeploy ?? /* @__PURE__ */ new Map()) {
    for (const rel of rels) {
      const abs = path29.resolve(anchor2, rel);
      if (!recorded.has(abs)) fromDeploy += 1;
      recorded.set(abs, null);
      try {
        recorded.set(fs30.realpathSync(abs), null);
      } catch {
      }
    }
  }
  if (fromDeploy > 0) sources.push("this-deploy");
  const manifestPath = opts.manifestPath ?? null;
  if (manifestPath !== null && fs30.existsSync(manifestPath)) {
    let n = 0;
    let recordedHashes;
    try {
      recordedHashes = readRecordedHashes(manifestPath, opts.projectRoot);
    } catch {
      recordedHashes = NO_RECORDED_HASHES;
    }
    for (const [abs, hash] of recordedHashes) {
      n += 1;
      recorded.set(abs, hash);
    }
    if (n > 0) sources.push("manifest");
  }
  if (recorded.size === 0) {
    return { recorded: NO_RECORDED_HASHES, sources: [], source: "none" };
  }
  const primary = sources.includes("manifest") ? "manifest" : sources.includes("global-inventory") ? "global-inventory" : "this-deploy";
  return { recorded, sources, source: primary };
}
function ownershipLine(sources) {
  const list = (Array.isArray(sources) ? sources : [sources]).filter(
    (s) => s !== "none"
  );
  if (list.length === 0) {
    return "ownership: NO manifest and NO deploy inventory resolved \u2014 every file reads foreign, which is no evidence rather than a finding";
  }
  const phrases = {
    manifest: "the installed-tools manifest",
    "global-inventory": "the global deploy inventory (deployed-files.json)",
    "this-deploy": "the file set this install just wrote"
  };
  const named = list.map((s) => phrases[s]);
  const joined = named.length === 1 ? named[0] : `${named.slice(0, -1).join(", ")} and ${named[named.length - 1]}`;
  return `ownership: read from ${joined}`;
}
function renderHostLimitRows(rows) {
  const out = [
    "host instruction budgets \u2014 package-owned + foreign against the published limit"
  ];
  for (const r of rows) {
    const split = `${String(r.package_owned_chars)} package-owned + ${String(r.foreign_chars)} foreign = ${String(r.chars)} chars`;
    if (r.limit === null) {
      out.push(`  ${r.host} \u2014 ${split}; no published limit recorded \u2014 not measured`);
      continue;
    }
    const pct = (r.fraction * 100).toFixed(1);
    out.push(
      `  ${r.host} \u2014 ${split}; ${pct}% of ${String(r.limit)} (${r.kind})` + (r.warn ? ` \u2014 WARNING: at or past ${String(Math.round(LIMIT_WARN_FRACTION * 100))}% of the published limit` : "")
    );
  }
  return out;
}

// src/scripts/_lib/thin_rules.ts
import { createHash as createHash10 } from "node:crypto";
import * as fs32 from "node:fs";
import * as path31 from "node:path";
import { fileURLToPath as fileURLToPath6 } from "node:url";

// src/scripts/_lib/rule_consequence_class.ts
import * as fs31 from "node:fs";
import * as path30 from "node:path";
var CLASS_CONFIG_REL = "src/config/rule-consequence-class.json";
function readConsequenceClass(repoRoot) {
  const raw = JSON.parse(fs31.readFileSync(path30.join(repoRoot, CLASS_CONFIG_REL), "utf-8"));
  return {
    criterion_ref: raw.criterion_ref ?? "",
    members: raw.members ?? {},
    no_stub: raw.no_stub ?? {},
    excluded: raw.excluded ?? {}
  };
}
function stubLawIds(cfg) {
  return new Set(Object.keys(cfg.members).filter((id) => cfg.no_stub[id] === void 0));
}

// src/scripts/_lib/rule_injection.ts
var PATH_TRIGGER_KINDS = ["path_prefix", "file_pattern"];
function tierEntries(router, tier) {
  const raw = router[tier];
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => ({
    id: String(r["id"] ?? ""),
    triggers: Array.isArray(r["triggers"]) ? r["triggers"] : []
  }));
}
function allTierRules(router) {
  const out = [];
  for (const tier of ["tier_1", "tier_2"]) {
    for (const e of tierEntries(router, tier)) out.push({ ...e, tier });
  }
  return out;
}
function pathOnlyRuleIds(router) {
  const ids = /* @__PURE__ */ new Set();
  for (const r of allTierRules(router)) {
    if (r.triggers.length === 0) continue;
    const allPath = r.triggers.every(
      (t) => PATH_TRIGGER_KINDS.some((k) => k in t)
    );
    if (allPath) ids.add(r.id);
  }
  return ids;
}
function triggerlessRuleIds(router) {
  return allTierRules(router).filter((r) => r.triggers.length === 0).map((r) => r.id);
}

// src/scripts/_lib/thin_rules.ts
var _HERE2 = fileURLToPath6(import.meta.url);
var REPO_ROOT = path31.resolve(path31.dirname(_HERE2), "..", "..", "..");
var RULES_SOURCE = path31.join(REPO_ROOT, "dist/agent-src", "rules");
var ROUTER = path31.join(REPO_ROOT, "dist", "router.json");
function _globSortedMd(dir) {
  let names;
  try {
    names = fs32.readdirSync(dir);
  } catch {
    return [];
  }
  const out = names.filter((n) => n.endsWith(".md")).map((n) => path31.join(dir, n));
  out.sort();
  return out;
}
function kernel_ids(routerPath = ROUTER) {
  const data = JSON.parse(fs32.readFileSync(routerPath, "utf-8"));
  const kernel = data.kernel;
  if (Array.isArray(kernel)) {
    return new Set(kernel.map((x) => String(x)));
  }
  return /* @__PURE__ */ new Set();
}
function _router(routerPath = ROUTER) {
  return JSON.parse(fs32.readFileSync(routerPath, "utf-8"));
}
function path_only_ids(routerPath = ROUTER) {
  return pathOnlyRuleIds(_router(routerPath));
}
function no_trigger_ids(routerPath = ROUTER) {
  return new Set(triggerlessRuleIds(_router(routerPath)));
}
function rule_workspaces_map(routerPath = ROUTER) {
  const data = JSON.parse(fs32.readFileSync(routerPath, "utf-8"));
  const map = /* @__PURE__ */ new Map();
  for (const tier of ["tier_1", "tier_2"]) {
    const entries = data[tier];
    if (!Array.isArray(entries)) continue;
    for (const e of entries) {
      const obj = e;
      const ws = Array.isArray(obj.workspaces) ? obj.workspaces.map((w) => String(w)) : [];
      map.set(String(obj.id), ws);
    }
  }
  return map;
}
function id_in_scope(rule_id, scope, kernel, wsMap, fallback_ws = []) {
  if (scope === null || kernel.has(rule_id)) {
    return true;
  }
  const ws = wsMap.get(rule_id) ?? fallback_ws;
  if (ws.length === 0) {
    return true;
  }
  return ws.some((w) => scope.includes(w));
}
function fm_workspaces(text) {
  const [fm] = split_frontmatter(text);
  const flow = /^workspaces:[ \t]*\[([^\]]*)\]/m.exec(fm);
  if (flow) {
    return flow[1].split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter((s) => s.length > 0);
  }
  const m = /^workspaces:[ \t]*\n((?:[ \t]+-[ \t]+.*(?:\n|$))+)/m.exec(fm);
  if (!m) {
    return [];
  }
  return [...m[1].matchAll(/-[ \t]+(\S+)/g)].map((x) => x[1]);
}
function split_frontmatter(text) {
  if (text.startsWith("---\n")) {
    const end = text.indexOf("\n---\n", 4);
    if (end !== -1) {
      return [text.slice(0, end + 5), text.slice(end + 5)];
    }
  }
  return ["", text];
}
function _description(fm) {
  const m = /^description:\s*"?(.+?)"?\s*$/m.exec(fm);
  return m ? m[1].trim() : "";
}
var _TRIGGER_HINT_LIMIT = 6;
function _trigger_hint(fm) {
  const hits = [];
  const re = /^\s*-\s*(?:keyword|phrase):\s*"?(.+?)"?\s*$/gm;
  let m;
  while ((m = re.exec(fm)) !== null) {
    hits.push(m[1].trim());
    if (hits.length >= _TRIGGER_HINT_LIMIT) {
      break;
    }
  }
  return hits.join(", ");
}
function _title(s) {
  return s.replace(/[A-Za-z]+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}
var THIN_ENTRY_MARKER = "> Load the body on a match.";
var THIN_BODY_POINTER_PREFIX = "Body: ";
var THIN_BODY_POINTER_RE = (() => {
  const lit = THIN_BODY_POINTER_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${lit}((?:(?!${lit}).)+\\.md)\\s*$`, "m");
})();
var BODY_LINK_PREFIX = "../../dist/agent-src/rules/";
function absoluteBodyLinkPrefix(packageRoot) {
  return `${path31.join(path31.resolve(packageRoot), "dist", "agent-src", "rules")}${path31.sep}`;
}
function thin_entry(rule_id, text, bodyLinkPrefix = BODY_LINK_PREFIX) {
  const [fm] = split_frontmatter(text);
  const desc = _description(fm);
  const hint = _trigger_hint(fm);
  const title = _title(rule_id.replace(/-/g, " "));
  const fires = hint ? ` Fires on: ${hint}.` : "";
  return `## ${title}
${THIN_ENTRY_MARKER}${fires} ${desc} ${THIN_BODY_POINTER_PREFIX}${bodyLinkPrefix}${rule_id}.md
`;
}
var STUB_LAW_OPEN = "<!-- law: byte-copied from the rule, sha256 ";
var STUB_LAW_CLOSE = "<!-- /law -->";
function lawDigest(law) {
  return createHash10("sha256").update(law, "utf-8").digest("hex").slice(0, 16);
}
var StubLawError = class extends Error {
  ruleId;
  constructor(ruleId, message) {
    super(message);
    this.name = "StubLawError";
    this.ruleId = ruleId;
  }
};
var STUB_LAW_MAX_CHARS = 2e3;
function thin_entry_with_law(rule_id, text, bodyLinkPrefix = BODY_LINK_PREFIX) {
  const law = lawText(ruleBody(text));
  if (law === null) {
    throw new StubLawError(
      rule_id,
      `${rule_id} is a high-consequence class member with no law section \u2014 write one, or record it under \`no_stub\` in src/config/rule-consequence-class.json with the reason`
    );
  }
  if (law.length > STUB_LAW_MAX_CHARS) {
    throw new StubLawError(
      rule_id,
      `${rule_id} is a high-consequence class member whose law section is ${law.length} chars, over the ${STUB_LAW_MAX_CHARS} ceiling \u2014 a stub never ships a shortened copy, so either the law moves under the ceiling or the rule is recorded under \`no_stub\` in src/config/rule-consequence-class.json with the reason`
    );
  }
  return thin_entry(rule_id, text, bodyLinkPrefix) + `
${STUB_LAW_OPEN}${lawDigest(law)} -->
${law}
${STUB_LAW_CLOSE}
`;
}
function build_thin(rules_dir = RULES_SOURCE, scope = null, announce = null, consequenceClass = null, roots = null) {
  const routerPath = roots?.routerPath ?? (roots?.packageRoot === void 0 ? ROUTER : path31.join(roots.packageRoot, "dist", "router.json"));
  const classRoot = roots?.packageRoot ?? REPO_ROOT;
  const bodyLinkPrefix = roots?.bodyLinkPrefix ?? BODY_LINK_PREFIX;
  const kernel = kernel_ids(routerPath);
  const noTrigger = no_trigger_ids(routerPath);
  const pathOnly = path_only_ids(routerPath);
  const cls = consequenceClass ?? readConsequenceClass(classRoot);
  const lawInStub = stubLawIds(cls);
  const wsMap = scope !== null ? rule_workspaces_map(routerPath) : /* @__PURE__ */ new Map();
  const out = /* @__PURE__ */ new Map();
  for (const p of _globSortedMd(rules_dir)) {
    const text = fs32.readFileSync(p, "utf-8");
    const stem = path31.basename(p).replace(/\.md$/, "");
    if (!id_in_scope(stem, scope, kernel, wsMap, fm_workspaces(text))) {
      continue;
    }
    const noStub = cls.no_stub[stem] !== void 0;
    const full = kernel.has(stem) || noTrigger.has(stem) || pathOnly.has(stem) || noStub;
    if (announce !== null && noTrigger.has(stem) && !kernel.has(stem)) {
      announce(`D3: trigger-less auto rule ${path31.basename(p)} \u2014 kept full-bodied, never thinned`);
    }
    if (announce !== null && pathOnly.has(stem) && !kernel.has(stem) && !noTrigger.has(stem)) {
      announce(
        `E2: path-only auto rule ${path31.basename(p)} \u2014 kept full-bodied; its only triggers are path-shaped and the delivery concern is not bound on pre_tool_use`
      );
    }
    if (full) {
      out.set(path31.basename(p), text);
      continue;
    }
    if (lawInStub.has(stem)) {
      if (announce !== null) {
        announce(
          `LAW: high-consequence rule ${path31.basename(p)} \u2014 stub carries its own law section, byte-copied`
        );
      }
      out.set(path31.basename(p), thin_entry_with_law(stem, text, bodyLinkPrefix));
      continue;
    }
    out.set(path31.basename(p), thin_entry(stem, text, bodyLinkPrefix));
  }
  return out;
}

// src/install/installThinLayer.ts
function thinInstalledRuleLayer(opts) {
  const packageRoot = path32.resolve(opts.packageRoot);
  const bodySourceDir = path32.join(packageRoot, "dist", "agent-src", "rules");
  const bodyLinkPrefix = absoluteBodyLinkPrefix(opts.bodyLinkRoot ?? packageRoot);
  const preserved = opts.preserved ?? /* @__PURE__ */ new Set();
  const stubs = build_thin(bodySourceDir, null, null, null, { packageRoot, bodyLinkPrefix });
  let thinned = 0;
  let rewritten = 0;
  let kept = 0;
  let charsBefore = 0;
  let charsAfter = 0;
  const preservedHits = [];
  const absent = [];
  const failed = [];
  for (const [name, stubText] of stubs) {
    const target = path32.join(opts.rulesDir, name);
    let installed;
    try {
      installed = fs33.readFileSync(target, "utf-8");
    } catch (e) {
      if (e.code === "ENOENT") absent.push(name);
      else failed.push({ rule: name, reason: String(e) });
      continue;
    }
    let sourceText;
    try {
      sourceText = fs33.readFileSync(path32.join(bodySourceDir, name), "utf-8");
    } catch {
      sourceText = null;
    }
    if (stubText === sourceText) {
      kept += 1;
      charsBefore += installed.length;
      charsAfter += installed.length;
      continue;
    }
    if (preserved.has(path32.resolve(target))) {
      preservedHits.push(name);
      charsBefore += installed.length;
      charsAfter += installed.length;
      continue;
    }
    const [frontmatter] = split_frontmatter(installed);
    charsBefore += installed.length;
    if (frontmatter === "" && /^\uFEFF?[\s]*---/.test(installed)) {
      failed.push({
        rule: name,
        reason: "opens a frontmatter block that never closes \u2014 left untouched so its ownership keys survive"
      });
      charsAfter += installed.length;
      continue;
    }
    const next = `${frontmatter}${stubText}`;
    try {
      if (next !== installed) {
        fs33.writeFileSync(target, next, "utf-8");
        opts.onWrite?.(target);
        rewritten += 1;
      }
      thinned += 1;
      charsAfter += next.length;
    } catch (e) {
      failed.push({ rule: name, reason: String(e) });
      charsAfter += installed.length;
    }
  }
  if (stubs.size === 0) {
    failed.push({
      rule: bodySourceDir,
      reason: "no rule bodies found to build stubs from \u2014 the layer was left full-bodied"
    });
  }
  return {
    thinned,
    rewritten,
    kept,
    preserved: preservedHits,
    absent,
    failed,
    bodyLinkPrefix,
    charsBefore,
    charsAfter
  };
}
function describeThinInstalledLayer(res) {
  const out = [];
  out.push(
    res.rewritten === 0 && res.thinned > 0 ? `  claude-code: ${String(res.thinned)} rule(s) already thinned, ${String(res.kept)} kept full-bodied; ${String(res.charsAfter)} chars \u2014 nothing to rewrite` : `  claude-code: thinned ${String(res.rewritten)} rule(s) to stubs, ${String(res.kept)} kept full-bodied; ${String(res.charsBefore)} -> ${String(res.charsAfter)} chars`
  );
  if (res.preserved.length > 0) {
    out.push(
      `  claude-code: ${String(res.preserved.length)} rule(s) left full \u2014 you edited them and they are preserved, never overwritten (${res.preserved.join(", ")})`
    );
  }
  for (const f of res.failed) {
    out.push(`  claude-code: ${f.rule}: could not write stub \u2014 ${f.reason}`);
  }
  return out;
}
function installReceiptBudgetLines(packageRoot, home = os12.homedir(), opts = {}) {
  try {
    const { recorded, sources } = resolveLayerOwnership({
      manifestPath: opts.manifestPath === void 0 ? manifest_path(packageRoot) : opts.manifestPath,
      projectRoot: packageRoot,
      // The same home the layers below are read from — the inventory's
      // anchor is tilde-relative, so the two must agree or the receipt
      // measures one install and claims ownership of another.
      home,
      // THE RECEIPT IS THE "ASKING PROCESS" CASE, so it names no home
      // here. It runs inside the install that WROTE the inventory, and
      // that writer resolves the path through `inventory_path()` —
      // honouring `AGENT_CONFIG_DEPLOY_INVENTORY`, which names a FILE
      // rather than a home, and `EVENT4U_CONFIG_HOME`. Passing `home`
      // would take `defaultInventoryPath`'s stated-home branch and read
      // `<home>/.event4u/...`, a file nothing wrote under either
      // override, and the inventory evidence would be silently lost.
      // UNDEFINED IS LEFT UNDEFINED so `resolveLayerOwnership` applies
      // `defaultInventoryPath(home)` — the SAME resolution the report
      // uses. Hardcoding `inventory_path()` here made the two readers
      // step 1.2 exists to reconcile disagree for any home that is not
      // the asking process's: the receipt read one install's inventory
      // and then expanded its tilde-relative anchors against the OTHER
      // home, which is the cross-home misattribution two docstrings in
      // the resolver forbid. `defaultInventoryPath` already returns
      // `inventory_path()` when the stated home IS this process's, which
      // is the case that motivated the hardcode.
      inventoryPath: opts.inventoryPath,
      thisDeploy: opts.thisDeploy
    });
    const layers = [];
    for (const host of Object.keys(GLOBAL_RULE_DIRS).sort()) {
      const dir = globalRuleLayerPath(host, home);
      if (dir === null) continue;
      layers.push(readLayer(host, "global", dir, recorded));
    }
    const rows = buildHostLimitRows(layers, loadHostInstructionLimits());
    if (rows.length === 0) return [];
    return [`  ${ownershipLine(sources)}`, ...renderHostLimitRows(rows).map((l) => `  ${l}`)];
  } catch {
    return [];
  }
}

// src/install/globalRuleScope.ts
function isPlainObject3(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function resolveGlobalRuleScope(inputs) {
  const { packageRoot, warn: warn2 } = inputs;
  const settings_path = inputs.settingsPath;
  if (settings_path === null) {
    try {
      return ruleScopeFromSettings(inputs.loadDefaults(), packageRoot);
    } catch {
      return LEGACY_ALL;
    }
  }
  let text;
  try {
    text = inputs.readText(settings_path);
  } catch (e) {
    warn2(
      `could not read ${settings_path} (${String(e)}) \u2014 rule scoping falls back to legacy-all, so ALL rules including maintainer-only ones will be installed. Fix the file to restore scoping.`
    );
    return LEGACY_ALL;
  }
  const parsed = inputs.parseYaml(text);
  if (!isPlainObject3(parsed)) {
    warn2(
      `${settings_path} is not a YAML mapping \u2014 rule scoping falls back to legacy-all, so ALL rules including maintainer-only ones will be installed. Fix the file to restore scoping.`
    );
    return LEGACY_ALL;
  }
  try {
    return ruleScopeFromSettings(parsed, packageRoot);
  } catch (e) {
    warn2(
      `could not derive rule scope from ${settings_path} (${String(e)}) \u2014 falling back to legacy-all; ALL rules will be installed.`
    );
    return LEGACY_ALL;
  }
}

// src/install/stagedRuntime.ts
import { spawnSync } from "node:child_process";
import { randomBytes as randomBytes6 } from "node:crypto";
import * as fs35 from "node:fs";
import { createRequire as createRequire3 } from "node:module";
import * as os13 from "node:os";
import * as path34 from "node:path";

// src/install/userPin.ts
import * as fs34 from "node:fs";
import * as path33 from "node:path";
var RECEIPT_FILE = "carrier.json";
var USER_PIN_FIELD = "user_pin";
function readReceipt(runtimeRoot) {
  try {
    const raw = JSON.parse(fs34.readFileSync(path33.join(runtimeRoot, RECEIPT_FILE), "utf8"));
    return typeof raw === "object" && raw !== null && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}
function readUserPin(runtimeRoot) {
  const v = readReceipt(runtimeRoot)[USER_PIN_FIELD];
  if (v === void 0 || v === null) return null;
  const o = typeof v === "object" ? v : {};
  return { form: "full", set_at: typeof o["set_at"] === "string" ? o["set_at"] : "unknown" };
}
function writeUserPin(runtimeRoot, now = /* @__PURE__ */ new Date()) {
  fs34.mkdirSync(runtimeRoot, { recursive: true });
  const receipt = readReceipt(runtimeRoot);
  const pin = { form: "full", set_at: now.toISOString().slice(0, 10) };
  receipt[USER_PIN_FIELD] = pin;
  fs34.writeFileSync(path33.join(runtimeRoot, RECEIPT_FILE), `${JSON.stringify(receipt, null, 2)}
`);
  return pin;
}
function describeUserPin(pin) {
  return pin === null ? null : `rule layer pinned full by \`install --full\` (since ${pin.set_at}) \u2014 the package will not thin it on this machine`;
}

// src/install/stagedRuntime.ts
var RUNTIME_DIRNAME = "runtime";
var CLAUDE_LAYER_DIRNAME = "claude-rules";
var THINNED_MARKER = "thinned";
var DEMOTED_MARKER = "demoted";
var CARRIER_RECORD = "carrier.json";
var PACKAGE_STAMP_LINE = "package: event4u/agent-config";
var STAGED_ENTRIES = [
  "package.json",
  "dist/hooks",
  "dist/agent-src",
  "dist/router.json",
  "src/scripts",
  "src/config"
];
var STAGED_RUNTIME_DEPS = ["yaml"];
function stageRuntimeDeps(packageRoot, stage) {
  const req = createRequire3(path34.join(packageRoot, "package.json"));
  for (const dep of STAGED_RUNTIME_DEPS) {
    let manifest;
    try {
      manifest = req.resolve(`${dep}/package.json`);
    } catch {
      continue;
    }
    fs35.cpSync(path34.dirname(manifest), path34.join(stage, "node_modules", dep), { recursive: true, dereference: true });
  }
}
function stagedFilter(src) {
  return !/\.m?ts$/.test(src);
}
function runtimeRootFor(env) {
  return path34.join(event4u_root(env ?? process.env), RUNTIME_DIRNAME);
}
function currentRuntimeDir(runtimeRoot) {
  return path34.join(runtimeRoot, "current");
}
function readVersion(packageRoot) {
  try {
    const pkg = JSON.parse(fs35.readFileSync(path34.join(packageRoot, "package.json"), "utf8"));
    return typeof pkg.version === "string" ? pkg.version : "unknown";
  } catch {
    return "unknown";
  }
}
function snapshotStampedLayer(rulesDir, dest) {
  fs35.mkdirSync(dest, { recursive: true });
  let names;
  try {
    names = fs35.readdirSync(rulesDir);
  } catch {
    return;
  }
  for (const name of names.sort()) {
    if (!name.endsWith(".md")) continue;
    const src = path34.join(rulesDir, name);
    let text;
    try {
      if (!fs35.statSync(src).isFile()) continue;
      text = fs35.readFileSync(src, "utf8");
    } catch {
      continue;
    }
    if (!text.split(/\r?\n/).includes(PACKAGE_STAMP_LINE)) continue;
    fs35.writeFileSync(path34.join(dest, name), text);
  }
}
function sweepStale(runtimeRoot, keep) {
  for (const name of fs35.readdirSync(runtimeRoot)) {
    const stale = name.startsWith("v-") && name !== keep || name.startsWith(".stage-") || name.startsWith(".current-");
    if (stale) fs35.rmSync(path34.join(runtimeRoot, name), { recursive: true, force: true });
  }
}
function stageRuntime(opts) {
  const runtimeRoot = path34.resolve(opts.runtimeRoot);
  const packageRoot = path34.resolve(opts.packageRoot);
  fs35.mkdirSync(runtimeRoot, { recursive: true });
  const version2 = readVersion(packageRoot);
  const nonce = `${process.pid}-${randomBytes6(4).toString("hex")}`;
  const stage = path34.join(runtimeRoot, `.stage-${nonce}`);
  fs35.mkdirSync(stage);
  let copied = 0;
  for (const rel of STAGED_ENTRIES) {
    const src = path34.join(packageRoot, rel);
    if (!fs35.existsSync(src)) continue;
    fs35.cpSync(src, path34.join(stage, rel), { recursive: true, dereference: true, filter: stagedFilter });
    copied += 1;
    if (opts._failAfterEntries !== void 0 && copied >= opts._failAfterEntries) {
      throw new Error("stageRuntime: injected fault");
    }
  }
  stageRuntimeDeps(packageRoot, stage);
  if (opts.claudeRulesDir) snapshotStampedLayer(opts.claudeRulesDir, path34.join(stage, CLAUDE_LAYER_DIRNAME));
  fs35.writeFileSync(path34.join(stage, "node"), `${opts.nodePath}
`);
  const versionDir = `v-${version2.replace(/[^A-Za-z0-9._-]/g, "_")}-${nonce}`;
  fs35.renameSync(stage, path34.join(runtimeRoot, versionDir));
  const current = currentRuntimeDir(runtimeRoot);
  const link = path34.join(runtimeRoot, `.current-${nonce}`);
  if (process.platform === "win32") {
    fs35.symlinkSync(path34.join(runtimeRoot, versionDir), link, "junction");
    fs35.rmSync(current, { recursive: true, force: true });
  } else {
    fs35.symlinkSync(versionDir, link);
  }
  fs35.renameSync(link, current);
  sweepStale(runtimeRoot, versionDir);
  return {
    currentDir: current,
    version: version2,
    dispatcher: fs35.existsSync(path34.join(current, "dist", "hooks", "dispatch.js"))
  };
}
function markClaudeLayer(runtimeRoot, opts) {
  fs35.mkdirSync(runtimeRoot, { recursive: true });
  const marker = path34.join(runtimeRoot, THINNED_MARKER);
  fs35.rmSync(path34.join(runtimeRoot, DEMOTED_MARKER), { force: true });
  if (opts.thinned) fs35.writeFileSync(marker, `${path34.resolve(opts.rulesDir)}
`);
  else fs35.rmSync(marker, { force: true });
}
function readCarrierState(runtimeRoot) {
  const layer = fs35.existsSync(path34.join(runtimeRoot, DEMOTED_MARKER)) ? "demoted" : fs35.existsSync(path34.join(runtimeRoot, THINNED_MARKER)) ? "thinned" : "full";
  let probe = null;
  try {
    const raw = JSON.parse(fs35.readFileSync(path34.join(runtimeRoot, CARRIER_RECORD), "utf8"));
    probe = raw.hosts?.["claude"] ?? null;
  } catch {
    probe = null;
  }
  return { layer, probe };
}
function layerAfterInstall(state2, opts) {
  if (!opts.wantsThin) return "full";
  if (opts.probe === "reached") return "thinned";
  return state2 === "demoted" ? "demoted" : "full";
}
var STRIPPED_PATH = "/usr/bin:/bin";
function probeHookCommand(command, env = process.env) {
  const probeCommand = command.replace(/--min-version (\d+)/g, "--min-version $1 --read-exit");
  const project = fs35.mkdtempSync(path34.join(os13.tmpdir(), "ac-carrier-probe-"));
  const stdinPath = path34.join(project, "stdin.json");
  fs35.writeFileSync(stdinPath, "{}");
  const fd = fs35.openSync(stdinPath, "r");
  try {
    const childEnv = {
      PATH: STRIPPED_PATH,
      CLAUDE_PROJECT_DIR: project,
      AC_HOOK_PROBE: "1"
    };
    for (const key of ["HOME", "USERPROFILE", "EVENT4U_CONFIG_HOME"]) {
      if (env[key] !== void 0) childEnv[key] = env[key];
    }
    const res = spawnSync("/bin/sh", ["-c", probeCommand], {
      cwd: project,
      stdio: [fd, "pipe", "pipe"],
      encoding: "utf-8",
      env: childEnv,
      timeout: 3e4
    });
    return typeof res.stderr === "string" && res.stderr.includes("--read-exit ok") ? "reached" : "not-reached";
  } catch {
    return "not-reached";
  } finally {
    fs35.closeSync(fd);
    fs35.rmSync(project, { recursive: true, force: true });
  }
}
function recordCarrierProbe(runtimeRoot, host, outcome, version2, now = /* @__PURE__ */ new Date()) {
  fs35.mkdirSync(runtimeRoot, { recursive: true });
  const file = path34.join(runtimeRoot, CARRIER_RECORD);
  let receipt = {};
  try {
    receipt = JSON.parse(fs35.readFileSync(file, "utf8"));
  } catch {
    receipt = {};
  }
  const hosts = receipt.hosts ?? {};
  const date2 = now.toISOString().slice(0, 10);
  const previous = hosts[host];
  const since = previous !== void 0 && previous.outcome === outcome ? previous.since ?? previous.date : date2;
  const record = { host, outcome, date: date2, version: version2, since };
  hosts[host] = record;
  fs35.writeFileSync(file, `${JSON.stringify({ ...receipt, hosts }, null, 2)}
`);
  return record;
}
function describeCarrierProbe(probe) {
  if (probe === null) return ["hook carrier (claude): not probed"];
  const verdict = probe.outcome === "reached" ? "reached" : "NOT reached";
  return [
    `hook carrier (${probe.host}): ${verdict} from a stripped environment (PATH=${STRIPPED_PATH}) \u2014 probed ${probe.date}, package ${probe.version}`
  ];
}
function prepareClaudeCarrier(opts) {
  const env = opts.env ?? process.env;
  const runtimeRoot = runtimeRootFor(env);
  const warnings = [];
  let staged = null;
  try {
    staged = stageRuntime({
      packageRoot: opts.packageRoot,
      runtimeRoot,
      nodePath: process.execPath,
      claudeRulesDir: opts.rulesDir
    });
  } catch (e) {
    warnings.push(`claude-code: runtime not staged under ${runtimeRoot} \u2014 ${String(e)}`);
  }
  if (opts.userPin === true) writeUserPin(runtimeRoot);
  const pin = readUserPin(runtimeRoot);
  const wantsThin = opts.wantsThin && staged !== null && pin === null;
  const probe = process.platform === "win32" || opts.sessionStartCommand === null ? null : probeHookCommand(opts.sessionStartCommand, env);
  if (probe !== null) recordCarrierProbe(runtimeRoot, "claude", probe, staged?.version ?? "unknown");
  const before = readCarrierState(runtimeRoot);
  const next = probe === null ? wantsThin ? "thinned" : "full" : layerAfterInstall(before.layer, { wantsThin, probe });
  if (next === "full") markClaudeLayer(runtimeRoot, { thinned: false, rulesDir: opts.rulesDir });
  const lines = describeCarrierProbe(readCarrierState(runtimeRoot).probe);
  const pinLine = describeUserPin(pin);
  if (pinLine !== null) lines.push(pinLine);
  if (next === "demoted") {
    lines.push("hook carrier (claude): machine demoted \u2014 the rule layer stays full until the probe passes");
  }
  return { thin: next === "thinned", bodyLinkRoot: staged?.currentDir ?? null, runtimeRoot, lines, warnings };
}
function sessionStartCommandFor(packageRoot) {
  try {
    return build_claude_hook_matrix(path34.join(packageRoot, "src", "scripts", "hook_manifest.yaml"))["SessionStart"] ?? null;
  } catch {
    return null;
  }
}
function deployClaudeCarrier(opts) {
  const carrier = prepareClaudeCarrier({
    packageRoot: opts.packageRoot,
    rulesDir: opts.rulesDir,
    sessionStartCommand: sessionStartCommandFor(opts.packageRoot),
    wantsThin: opts.wantsThin,
    ...opts.userPin === true ? { userPin: true } : {}
  });
  for (const w of carrier.warnings) opts.warn(w);
  if (!opts.quiet) for (const l of carrier.lines) opts.info(l);
  if (!carrier.thin) return;
  try {
    const lines = opts.thin(carrier.bodyLinkRoot);
    markClaudeLayer(carrier.runtimeRoot, { thinned: true, rulesDir: opts.rulesDir });
    if (!opts.quiet) for (const l of lines) opts.info(l);
  } catch (e) {
    markClaudeLayer(carrier.runtimeRoot, { thinned: false, rulesDir: opts.rulesDir });
    opts.warn(`claude-code: thinned rule layer not written \u2014 ${String(e)}`);
  }
}

// src/install/toolsArg.ts
function mergeToolsAliases(tools, ai) {
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

// src/scripts/_lib/project_tree_form.ts
import * as path35 from "node:path";
var PROJECT_TREE_FORM_REL = path35.join("src", "config", "project-tree-form.json");

// src/scripts/_lib/lean_projection_mode.ts
function installerThinsHost(_hostId, _opts = {}) {
  return false;
}

// src/install/wizard-plan.ts
import { homedir as homedir15 } from "node:os";
import { isAbsolute as isAbsolute7, join as join39, resolve as resolve20 } from "node:path";
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
var CLAUDE_SKILL_BUNDLE = [
  ["dist/agent-src/rules", "rules"],
  ["dist/agent-src/skills", "skills"],
  // Commands ship to ~/.claude/commands/ — native Claude Code slash-
  // command surface. Verified empirically 2026-05-28: rich frontmatter
  // (disable-model-invocation, custom fields) tolerated; nested
  // subdirs route as `/<cluster>:<sub>`. Council session 2026-05-28
  // converged on Option B (native slash-only) — see
  // agents/runtime/council/responses/claude-code-distribution.json
  // and `_CLAUDE_SKILL_BUNDLE` in the retired Python installer for the Python mirror.
  ["dist/agent-src/commands", "commands"],
  ["dist/agent-src/personas", "personas"]
];
var RULE_SOURCE_REL = "dist/agent-src/rules";
var GLOBAL_DEPLOY_SOURCES = {
  "claude-code": CLAUDE_SKILL_BUNDLE,
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
  windsurf: [
    ["dist/agent-src/rules", "rules"]
  ],
  cline: [
    ["dist/agent-src/rules", ""]
  ],
  "gemini-cli": CLAUDE_SKILL_BUNDLE,
  codex: CLAUDE_SKILL_BUNDLE,
  continue: CLAUDE_SKILL_BUNDLE,
  roocode: CLAUDE_SKILL_BUNDLE,
  kilocode: CLAUDE_SKILL_BUNDLE,
  qoder: CLAUDE_SKILL_BUNDLE,
  opencode: CLAUDE_SKILL_BUNDLE,
  trae: CLAUDE_SKILL_BUNDLE,
  antigravity: CLAUDE_SKILL_BUNDLE,
  codebuddy: CLAUDE_SKILL_BUNDLE,
  droid: CLAUDE_SKILL_BUNDLE,
  warp: CLAUDE_SKILL_BUNDLE,
  kiro: [
    ["dist/agent-src/rules", "rules"],
    ["dist/agent-src/skills", "steering"],
    ["dist/agent-src/personas", "personas"]
  ]
};
function dryRunTargetLines(global, tools, projectTarget) {
  if (!global) return `  target:      ${projectTarget}
`;
  let out = "  target:      user-scope host paths (no project target)\n";
  for (const tool of tools) {
    const anchor2 = USER_SCOPE_PATHS[tool];
    if (anchor2 === void 0) continue;
    out += `      ${tool} \u2192 ${anchor2.startsWith("~/") ? join39(homedir15(), anchor2.slice(2)) : anchor2}
`;
  }
  out += "  phases:      project payload sync \u2014 skipped (global installs write user-scope paths only)\n";
  out += "               host projection + managed hooks \u2014 would run\n";
  return out;
}

// src/shared/settingsSurface.ts
function unwrapRef(root) {
  if (root.$ref !== void 0 && root.definitions !== void 0) {
    const name = root.$ref.replace("#/definitions/", "");
    const def = root.definitions[name];
    if (def !== void 0) return def;
  }
  return root;
}
function flattenSurface(schema, version2) {
  const entries = {};
  const walk = (node2, prefix) => {
    if (node2.type === "object" && node2.properties !== void 0 && Object.keys(node2.properties).length > 0) {
      for (const key of Object.keys(node2.properties).sort()) {
        const child = node2.properties[key];
        walk(child, prefix === "" ? key : `${prefix}.${key}`);
      }
      return;
    }
    if (prefix === "") return;
    const entry = { type: node2.type ?? (node2.enum !== void 0 ? "enum" : "unknown") };
    if (node2.default !== void 0) entry.default = node2.default;
    if (node2.enum !== void 0) entry.enum = [...node2.enum];
    if (node2.description !== void 0) entry.description = node2.description;
    entries[prefix] = entry;
  };
  walk(unwrapRef(schema), "");
  return { version: version2, entries };
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
    if (!sameJson(o.type, n.type)) {
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

// node_modules/zod/v4/core/util.js
var util_exports = {};
__export(util_exports, {
  BIGINT_FORMAT_RANGES: () => BIGINT_FORMAT_RANGES,
  CONSTANT_CATCH: () => CONSTANT_CATCH,
  Class: () => Class,
  NUMBER_FORMAT_RANGES: () => NUMBER_FORMAT_RANGES,
  aborted: () => aborted,
  allowsEval: () => allowsEval,
  assert: () => assert,
  assertEqual: () => assertEqual,
  assertIs: () => assertIs,
  assertNever: () => assertNever,
  assertNotEqual: () => assertNotEqual,
  assignProp: () => assignProp,
  attachSchema: () => attachSchema,
  base64ToUint8Array: () => base64ToUint8Array,
  base64urlToUint8Array: () => base64urlToUint8Array,
  cached: () => cached,
  captureStackTrace: () => captureStackTrace,
  cleanEnum: () => cleanEnum,
  cleanRegex: () => cleanRegex,
  clone: () => clone,
  cloneDef: () => cloneDef,
  codePointLength: () => codePointLength,
  constantCatch: () => constantCatch,
  createTransparentProxy: () => createTransparentProxy,
  defineLazy: () => defineLazy,
  defineLazyInternal: () => defineLazyInternal,
  derived: () => derived,
  esc: () => esc,
  escapeRegex: () => escapeRegex,
  explicitlyAborted: () => explicitlyAborted,
  extend: () => extend,
  finalizeIssue: () => finalizeIssue,
  floatSafeRemainder: () => floatSafeRemainder,
  getElementAtPath: () => getElementAtPath,
  getEnumValues: () => getEnumValues,
  getLengthableOrigin: () => getLengthableOrigin,
  getParsedType: () => getParsedType,
  getSizableOrigin: () => getSizableOrigin,
  hexToUint8Array: () => hexToUint8Array,
  hide: () => hide,
  installLazyProp: () => installLazyProp,
  isObject: () => isObject,
  isPlainObject: () => isPlainObject4,
  issue: () => issue,
  joinValues: () => joinValues,
  jsonStringifyReplacer: () => jsonStringifyReplacer,
  members: () => members,
  merge: () => merge,
  mergeDefs: () => mergeDefs,
  normalizeParams: () => normalizeParams,
  nullish: () => nullish,
  numKeys: () => numKeys,
  objectClone: () => objectClone,
  omit: () => omit,
  optionalKeys: () => optionalKeys,
  own: () => own,
  parsedType: () => parsedType,
  partial: () => partial,
  pick: () => pick,
  prefixIssues: () => prefixIssues,
  primitiveTypes: () => primitiveTypes,
  promiseAllObject: () => promiseAllObject,
  propertyKeyTypes: () => propertyKeyTypes,
  randomString: () => randomString,
  rawShape: () => rawShape,
  required: () => required,
  safeExtend: () => safeExtend,
  shallowClone: () => shallowClone,
  sizeCaps: () => sizeCaps,
  slugify: () => slugify,
  stringifyPrimitive: () => stringifyPrimitive,
  toZod: () => toZod,
  uint8ArrayToBase64: () => uint8ArrayToBase64,
  uint8ArrayToBase64url: () => uint8ArrayToBase64url,
  uint8ArrayToHex: () => uint8ArrayToHex,
  unwrapMessage: () => unwrapMessage
});
function assertEqual(val) {
  return val;
}
function assertNotEqual(val) {
  return val;
}
function toZod() {
  return (schema) => schema;
}
function assertIs(_arg) {
}
function assertNever(_x) {
  throw new Error("Unexpected value in exhaustive check");
}
function assert(_) {
}
function getEnumValues(entries) {
  const numericValues = Object.values(entries).filter((v) => typeof v === "number");
  const values = Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
  return values;
}
function joinValues(array2, separator = "|") {
  return array2.map((val) => stringifyPrimitive(val)).join(separator);
}
function jsonStringifyReplacer(_, value) {
  if (typeof value === "bigint")
    return value.toString();
  return value;
}
var Cached = class {
  constructor(getter) {
    this._getter = getter;
    this._value = void 0;
  }
  get value() {
    const getter = this._getter;
    if (getter !== void 0) {
      this._value = getter();
      this._getter = void 0;
    }
    return this._value;
  }
};
function cached(getter) {
  return new Cached(getter);
}
function nullish(input) {
  return input === null || input === void 0;
}
function cleanRegex(source) {
  const start = source.startsWith("^") ? 1 : 0;
  const end = source.endsWith("$") ? source.length - 1 : source.length;
  return source.slice(start, end);
}
function floatSafeRemainder(val, step) {
  const ratio = val / step;
  const roundedRatio = Math.round(ratio);
  const tolerance = 4 * Number.EPSILON * Math.max(Math.abs(ratio), 1);
  if (Math.abs(ratio - roundedRatio) < tolerance)
    return 0;
  return ratio - roundedRatio;
}
var EVALUATING = /* @__PURE__ */ Symbol("evaluating");
function defineLazy(object2, key, getter) {
  let value = void 0;
  Object.defineProperty(object2, key, {
    get() {
      if (value === EVALUATING) {
        return void 0;
      }
      if (value === void 0) {
        value = EVALUATING;
        value = getter();
      }
      return value;
    },
    set(v) {
      Object.defineProperty(object2, key, {
        value: v
        // configurable: true,
      });
    },
    configurable: true
  });
}
function objectClone(obj) {
  return Object.create(Object.getPrototypeOf(obj), Object.getOwnPropertyDescriptors(obj));
}
function assignProp(target, prop, value) {
  Object.defineProperty(target, prop, {
    value,
    writable: true,
    enumerable: true,
    configurable: true
  });
}
function rawShape(def) {
  const desc = Object.getOwnPropertyDescriptor(def, "shape");
  return desc?.get ? desc.get.raw : desc?.value;
}
function sourceShape(schema) {
  return rawShape(schema._zod.def) ?? schema._zod.def.shape;
}
function deferProp(target, key, getter) {
  Object.defineProperty(target, key, {
    get() {
      const value = getter();
      assignProp(this, key, value);
      return value;
    },
    enumerable: true,
    configurable: true
  });
}
function putProp(target, key, value) {
  if (key in target)
    assignProp(target, key, value);
  else
    target[key] = value;
}
function mirrorShape(target, source, keys, wrap) {
  const raw = sourceShape(source);
  for (const key of keys) {
    const desc = Object.getOwnPropertyDescriptor(raw, key);
    if (!desc.enumerable)
      continue;
    if (desc.get) {
      deferProp(target, key, () => {
        const value = source._zod.def.shape[key];
        return wrap ? wrap(value, key) : value;
      });
    } else
      putProp(target, key, wrap ? wrap(desc.value, key) : desc.value);
  }
}
function mirrorProps(target, source) {
  for (const key of Reflect.ownKeys(source)) {
    const desc = Object.getOwnPropertyDescriptor(source, key);
    if (!desc.enumerable)
      continue;
    if (desc.get)
      deferProp(target, key, () => source[key]);
    else
      putProp(target, key, desc.value);
  }
}
function mergeDefs(...defs) {
  const mergedDescriptors = {};
  for (const def of defs) {
    const descriptors = Object.getOwnPropertyDescriptors(def);
    Object.assign(mergedDescriptors, descriptors);
  }
  return Object.defineProperties({}, mergedDescriptors);
}
function cloneDef(schema) {
  return mergeDefs(schema._zod.def);
}
function getElementAtPath(obj, path39) {
  if (!path39)
    return obj;
  return path39.reduce((acc, key) => acc?.[key], obj);
}
function promiseAllObject(promisesObj) {
  const keys = Object.keys(promisesObj);
  const promises = keys.map((key) => promisesObj[key]);
  return Promise.all(promises).then((results) => {
    const resolvedObj = {};
    for (let i = 0; i < keys.length; i++) {
      resolvedObj[keys[i]] = results[i];
    }
    return resolvedObj;
  });
}
function randomString(length = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let str = "";
  for (let i = 0; i < length; i++) {
    str += chars[Math.floor(Math.random() * chars.length)];
  }
  return str;
}
function esc(str) {
  return JSON.stringify(str);
}
function slugify(input) {
  return input.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}
var captureStackTrace = "captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => {
};
function isObject(data) {
  return typeof data === "object" && data !== null && !Array.isArray(data);
}
var allowsEval = /* @__PURE__ */ cached(() => {
  if (globalConfig.jitless) {
    return false;
  }
  if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) {
    return false;
  }
  try {
    const F = Function;
    new F("");
    return true;
  } catch (_) {
    return false;
  }
});
function isPlainObject4(o) {
  if (isObject(o) === false)
    return false;
  const ctor = o.constructor;
  if (ctor === void 0)
    return true;
  if (typeof ctor !== "function")
    return true;
  const prot = ctor.prototype;
  if (isObject(prot) === false)
    return false;
  if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) {
    return false;
  }
  return true;
}
function shallowClone(o) {
  if (isPlainObject4(o))
    return { ...o };
  if (Array.isArray(o))
    return [...o];
  if (o instanceof Map)
    return new Map(o);
  if (o instanceof Set)
    return new Set(o);
  return o;
}
function numKeys(data) {
  let keyCount = 0;
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      keyCount++;
    }
  }
  return keyCount;
}
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return "undefined";
    case "string":
      return "string";
    case "number":
      return Number.isNaN(data) ? "nan" : "number";
    case "boolean":
      return "boolean";
    case "function":
      return "function";
    case "bigint":
      return "bigint";
    case "symbol":
      return "symbol";
    case "object":
      if (Array.isArray(data)) {
        return "array";
      }
      if (data === null) {
        return "null";
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return "promise";
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return "map";
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return "set";
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return "date";
      }
      if (typeof File !== "undefined" && data instanceof File) {
        return "file";
      }
      return "object";
    default:
      throw new Error(`Unknown data type: ${t}`);
  }
};
var propertyKeyTypes = /* @__PURE__ */ new Set(["string", "number", "symbol"]);
var primitiveTypes = /* @__PURE__ */ new Set([
  "string",
  "number",
  "bigint",
  "boolean",
  "symbol",
  "undefined"
]);
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function clone(inst, def, params) {
  const cl = new inst._zod.constr(def ?? inst._zod.def);
  if (!def || params?.parent)
    cl._zod.parent = inst;
  return cl;
}
function normalizeParams(_params) {
  const params = _params;
  if (!params)
    return {};
  if (typeof params === "string")
    return { error: () => params };
  if (params?.message !== void 0) {
    if (params?.error !== void 0)
      throw new Error("Cannot specify both `message` and `error` params");
    params.error = params.message;
  }
  delete params.message;
  if (typeof params.error === "string")
    return { ...params, error: () => params.error };
  return params;
}
function createTransparentProxy(getter) {
  let target;
  return new Proxy({}, {
    get(_, prop, receiver) {
      target ?? (target = getter());
      return Reflect.get(target, prop, receiver);
    },
    set(_, prop, value, receiver) {
      target ?? (target = getter());
      return Reflect.set(target, prop, value, receiver);
    },
    has(_, prop) {
      target ?? (target = getter());
      return Reflect.has(target, prop);
    },
    deleteProperty(_, prop) {
      target ?? (target = getter());
      return Reflect.deleteProperty(target, prop);
    },
    ownKeys(_) {
      target ?? (target = getter());
      return Reflect.ownKeys(target);
    },
    getOwnPropertyDescriptor(_, prop) {
      target ?? (target = getter());
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
    defineProperty(_, prop, descriptor) {
      target ?? (target = getter());
      return Reflect.defineProperty(target, prop, descriptor);
    }
  });
}
function stringifyPrimitive(value) {
  if (typeof value === "bigint")
    return value.toString() + "n";
  if (typeof value === "string")
    return `"${value}"`;
  return `${value}`;
}
function optionalKeys(shape) {
  return Object.keys(shape).filter((k) => {
    return shape[k]._zod.optin !== void 0 && shape[k]._zod.optout === "optional";
  });
}
var NUMBER_FORMAT_RANGES = /* @__PURE__ */ (() => ({
  safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  int32: [-2147483648, 2147483647],
  uint32: [0, 4294967295],
  float32: [-34028234663852886e22, 34028234663852886e22],
  float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
}))();
var BIGINT_FORMAT_RANGES = {
  int64: [/* @__PURE__ */ BigInt("-9223372036854775808"), /* @__PURE__ */ BigInt("9223372036854775807")],
  uint64: [/* @__PURE__ */ BigInt(0), /* @__PURE__ */ BigInt("18446744073709551615")]
};
function pick(schema, mask) {
  const currDef = schema._zod.def;
  const checks = currDef.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    throw new Error(".pick() cannot be used on object schemas containing refinements");
  }
  const newShape = {};
  mirrorShape(newShape, schema, maskedKeys(schema, mask));
  return clone(schema, mergeDefs(currDef, { shape: newShape, checks: [] }));
}
function maskedKeys(schema, mask) {
  const raw = sourceShape(schema);
  const keys = [];
  for (const key of Reflect.ownKeys(mask)) {
    if (!Object.getOwnPropertyDescriptor(raw, key)?.enumerable) {
      throw new Error(`Unrecognized key: "${String(key)}"`);
    }
    if (mask[key])
      keys.push(key);
  }
  return keys;
}
function omit(schema, mask) {
  const currDef = schema._zod.def;
  const checks = currDef.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    throw new Error(".omit() cannot be used on object schemas containing refinements");
  }
  const omitted = new Set(maskedKeys(schema, mask));
  const newShape = {};
  mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)).filter((key) => !omitted.has(key)));
  return clone(schema, mergeDefs(currDef, { shape: newShape, checks: [] }));
}
function extend(schema, shape) {
  if (!isPlainObject4(shape)) {
    throw new Error("Invalid input to extend: expected a plain object");
  }
  const checks = schema._zod.def.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    const existingShape = sourceShape(schema);
    for (const key of Reflect.ownKeys(shape)) {
      if (Object.getOwnPropertyDescriptor(existingShape, key) !== void 0) {
        throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
      }
    }
  }
  return clone(schema, mergeDefs(schema._zod.def, { shape: extended(schema, shape) }));
}
function extended(schema, shape) {
  const newShape = {};
  mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)));
  mirrorProps(newShape, shape);
  return newShape;
}
function safeExtend(schema, shape) {
  if (!isPlainObject4(shape)) {
    throw new Error("Invalid input to safeExtend: expected a plain object");
  }
  return clone(schema, mergeDefs(schema._zod.def, { shape: extended(schema, shape) }));
}
function merge(a, b) {
  if (!b?._zod?.def) {
    throw new Error("Invalid input to merge: expected an object schema. To merge a plain shape, use `.extend()`.");
  }
  if (a._zod.def.checks?.length) {
    throw new Error(".merge() cannot be used on object schemas containing refinements. Use .safeExtend() instead.");
  }
  const newShape = {};
  mirrorShape(newShape, a, Reflect.ownKeys(sourceShape(a)));
  mirrorShape(newShape, b, Reflect.ownKeys(sourceShape(b)));
  const def = mergeDefs(a._zod.def, {
    shape: newShape,
    get catchall() {
      return b._zod.def.catchall;
    },
    checks: b._zod.def.checks ?? []
  });
  return clone(a, def);
}
function partial(Class2, schema, mask, name = "partial") {
  const currDef = schema._zod.def;
  const checks = currDef.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    throw new Error(`.${name}() cannot be used on object schemas containing refinements`);
  }
  const selected = mask ? new Set(maskedKeys(schema, mask)) : void 0;
  const newShape = {};
  mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)), Class2 && ((value, key) => selected && !selected.has(key) ? value : new Class2({ type: "optional", innerType: value })));
  return clone(schema, mergeDefs(schema._zod.def, { shape: newShape, checks: [] }));
}
function required(Class2, schema, mask) {
  const selected = mask ? new Set(maskedKeys(schema, mask)) : void 0;
  const newShape = {};
  mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)), (value, key) => (
    // overwrite with non-optional
    selected && !selected.has(key) ? value : new Class2({ type: "nonoptional", innerType: value })
  ));
  return clone(schema, mergeDefs(schema._zod.def, { shape: newShape }));
}
function aborted(x, startIndex = 0) {
  if (x.aborted === true)
    return true;
  for (let i = startIndex; i < x.issues.length; i++) {
    if (x.issues[i]?.continue !== true) {
      return true;
    }
  }
  return false;
}
function explicitlyAborted(x, startIndex = 0) {
  if (x.aborted === true)
    return true;
  for (let i = startIndex; i < x.issues.length; i++) {
    if (x.issues[i]?.continue === false) {
      return true;
    }
  }
  return false;
}
function prefixIssues(path39, issues) {
  return issues.map((iss) => {
    var _a3;
    (_a3 = iss).path ?? (_a3.path = []);
    iss.path.unshift(path39);
    return iss;
  });
}
function unwrapMessage(message) {
  return typeof message === "string" ? message : message?.message;
}
function sizeCaps(defChecks) {
  const caps = [];
  for (const ch of defChecks ?? []) {
    const d = ch._zod.def;
    if (!/_(length|size)$|_equals$/.test(d.check))
      break;
    const max = d.maximum ?? d.length ?? d.size;
    if (max >= 0)
      caps.push([max, ch]);
  }
  return caps;
}
function attachSchema(issues, start, inst) {
  var _a3;
  for (let i = start; i < issues.length; i++) {
    (_a3 = issues[i]).schema ?? (_a3.schema = inst);
  }
}
function finalizeIssue(iss, ctx, config2) {
  var _a3;
  const traits = iss.inst?._zod?.traits;
  if (traits?.has("$ZodType")) {
    if (traits.has("$ZodCheck"))
      (_a3 = iss).schema ?? (_a3.schema = iss.inst);
    else
      iss.schema = iss.inst;
  }
  const schemaError = iss.schema !== iss.inst ? iss.schema?._zod.def?.error : void 0;
  const message = iss.message ? iss.message : unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ?? unwrapMessage(schemaError?.(iss)) ?? unwrapMessage(ctx?.error?.(iss)) ?? unwrapMessage(config2.customError?.(iss)) ?? unwrapMessage(config2.localeError?.(iss)) ?? "Invalid input";
  const full = {};
  for (const k of Object.keys(iss)) {
    if (k === "inst" || k === "schema" || k === "continue" || k === "input" || k === "__proto__")
      continue;
    full[k] = iss[k];
  }
  full.path ?? (full.path = []);
  full.message = message;
  if (ctx?.reportInput) {
    full.input = iss.input;
  }
  return full;
}
function getSizableOrigin(input) {
  if (input instanceof Set)
    return "set";
  if (input instanceof Map)
    return "map";
  if (input instanceof File)
    return "file";
  return "unknown";
}
var highSurrogate = /[\uD800-\uDBFF]/;
function codePointLength(str) {
  const units = str.length;
  if (!highSurrogate.test(str))
    return units;
  let count = units;
  for (let i = 0; i < units - 1; i++) {
    if ((str.charCodeAt(i) & 64512) === 55296 && (str.charCodeAt(i + 1) & 64512) === 56320) {
      count--;
      i++;
    }
  }
  return count;
}
function getLengthableOrigin(input) {
  if (Array.isArray(input))
    return "array";
  if (typeof input === "string")
    return "string";
  return "unknown";
}
function parsedType(data) {
  const t = typeof data;
  switch (t) {
    case "number": {
      return Number.isNaN(data) ? "nan" : "number";
    }
    case "object": {
      if (data === null) {
        return "null";
      }
      if (Array.isArray(data)) {
        return "array";
      }
      const obj = data;
      if (obj && Object.getPrototypeOf(obj) !== Object.prototype && "constructor" in obj && obj.constructor) {
        return obj.constructor.name;
      }
    }
  }
  return t;
}
function issue(...args) {
  const [iss, input, inst] = args;
  if (typeof iss === "string") {
    return {
      message: iss,
      code: "custom",
      input,
      inst
    };
  }
  return { ...iss };
}
function cleanEnum(obj) {
  return Object.entries(obj).filter(([k, _]) => {
    return Number.isNaN(Number.parseInt(k, 10));
  }).map((el) => el[1]);
}
function base64ToUint8Array(base642) {
  const binaryString = atob(base642);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
function uint8ArrayToBase64(bytes) {
  let binaryString = "";
  for (let i = 0; i < bytes.length; i++) {
    binaryString += String.fromCharCode(bytes[i]);
  }
  return btoa(binaryString);
}
function base64urlToUint8Array(base64url2) {
  const base642 = base64url2.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - base642.length % 4) % 4);
  return base64ToUint8Array(base642 + padding);
}
function uint8ArrayToBase64url(bytes) {
  return uint8ArrayToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function hexToUint8Array(hex) {
  const cleanHex = hex.replace(/^0x/, "");
  if (cleanHex.length % 2 !== 0) {
    throw new Error("Invalid hex string length");
  }
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(cleanHex.slice(i, i + 2), 16);
  }
  return bytes;
}
function uint8ArrayToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
var Class = class {
  constructor(..._args) {
  }
};
function members(proto, table) {
  for (const key in table) {
    const desc = Object.getOwnPropertyDescriptor(table, key);
    if (desc.get)
      Object.defineProperty(proto, key, { ...desc, enumerable: false });
    else
      defineBound(proto, key, desc.value);
  }
}
function own(inst, key, value, enumerable = true) {
  Object.defineProperty(inst, key, { configurable: true, writable: true, enumerable, value });
  return value;
}
function hide(inst, key, value) {
  return own(inst, key, value, false);
}
// @__NO_SIDE_EFFECTS__
function derived(computes, table) {
  for (const key in computes) {
    const compute = computes[key];
    Object.defineProperty(table, key, {
      configurable: true,
      enumerable: true,
      get() {
        return own(this, key, compute(this));
      },
      set(value) {
        own(this, key, value);
      }
    });
  }
  return table;
}
function defineBound(proto, key, fn) {
  Object.defineProperty(proto, key, {
    configurable: true,
    get() {
      return this == null ? fn : own(this, key, fn.bind(this));
    },
    set(value) {
      own(this, key, value);
    }
  });
}
function claim(inst, sentinel) {
  const proto = Object.getPrototypeOf(inst);
  return sentinel in proto ? void 0 : proto;
}
var installing;
var broke = false;
var breaker = {
  configurable: true,
  get() {
    broke = true;
    return void 0;
  }
};
function defineLazyInternal(inst, key, compute) {
  const proto = Object.getPrototypeOf(inst._zod);
  if (key in proto && installing !== inst._zod) {
    installing = void 0;
    return;
  }
  installing = inst._zod;
  Object.defineProperty(proto, key, {
    configurable: true,
    get() {
      Object.defineProperty(this, key, breaker);
      const outer = broke;
      broke = false;
      try {
        const value = compute(this);
        if (broke)
          delete this[key];
        else
          Object.defineProperty(this, key, { configurable: true, writable: true, value });
        broke = broke || outer;
        return value;
      } catch (err) {
        delete this[key];
        broke = broke || outer;
        throw err;
      }
    },
    set(value) {
      Object.defineProperty(this, key, { configurable: true, writable: true, value });
    }
  });
}
function installLazyProp(inst, key, make, enumerable) {
  const proto = claim(inst, key);
  if (!proto)
    return;
  Object.defineProperty(proto, key, {
    configurable: true,
    get() {
      const desc = { configurable: true, writable: true, enumerable, value: void 0 };
      Object.defineProperty(this, key, desc);
      desc.value = make(this);
      Object.defineProperty(this, key, desc);
      return desc.value;
    },
    set(value) {
      Object.defineProperty(this, key, { configurable: true, writable: true, enumerable, value });
    }
  });
}
var CONSTANT_CATCH = "~constantCatch";
function constantCatch(value) {
  const fn = () => value;
  fn[CONSTANT_CATCH] = true;
  return fn;
}

// node_modules/zod/v4/core/core.js
var _a;
var _zodDesc = { value: void 0, enumerable: false };
var _E = "captureStackTrace" in Error ? Error : null;
function newError(Definition) {
  const E = _E;
  if (E) {
    const saved = E.stackTraceLimit;
    if (typeof saved === "number") {
      try {
        E.stackTraceLimit = 0;
      } catch {
        _E = null;
        return new Definition();
      }
      try {
        return new Definition();
      } finally {
        E.stackTraceLimit = saved;
      }
    }
  }
  return new Definition();
}
// @__NO_SIDE_EFFECTS__
function $constructor(name, initializer3, proto, params) {
  const zodProto = {};
  function Internals(def) {
    this.def = def;
    this.constr = _;
    this.traits = /* @__PURE__ */ new Set();
  }
  Internals.prototype = zodProto;
  const protoMembers = proto;
  const initialized = protoMembers && /* @__PURE__ */ new WeakSet();
  function init(inst, def) {
    if (!inst._zod) {
      _zodDesc.value = new Internals(def);
      try {
        Object.defineProperty(inst, "_zod", _zodDesc);
      } finally {
        _zodDesc.value = void 0;
      }
    } else if (inst._zod.traits.has(name)) {
      return;
    }
    inst._zod.traits.add(name);
    initializer3(inst, def);
    if (initialized) {
      const own2 = Object.getPrototypeOf(inst);
      const ctorProto = inst._zod.constr.prototype;
      let up = own2;
      while (up && up !== ctorProto)
        up = Object.getPrototypeOf(up);
      const target = up ?? own2;
      if (!initialized.has(target)) {
        initialized.add(target);
        members(target, protoMembers);
      }
    }
    const proto2 = _.prototype;
    for (const k in proto2) {
      if (!Object.prototype.hasOwnProperty.call(proto2, k))
        continue;
      if (!(k in inst)) {
        inst[k] = proto2[k].bind(inst);
      }
    }
  }
  const Parent = params?.Parent ?? Object;
  class Definition extends Parent {
  }
  Object.defineProperty(Definition, "name", { value: name });
  function _(def) {
    const inst = params?.Parent ? newError(Definition) : this;
    init(inst, def);
    const deferred = inst._zod.deferred;
    if (deferred) {
      for (const fn of deferred) {
        fn();
      }
      inst._zod.deferred = void 0;
    }
    const pp = globalThis.__zod_globalConfig?.postProcessor;
    if (pp)
      pp(inst);
    return inst;
  }
  Object.defineProperty(_, "init", { value: init });
  Object.defineProperty(_, Symbol.hasInstance, {
    value: (inst) => {
      if (params?.Parent && inst instanceof params.Parent)
        return true;
      return inst?._zod?.traits?.has(name);
    }
  });
  Object.defineProperty(_, "name", { value: name });
  return _;
}
var $ZodAsyncError = class extends Error {
  constructor() {
    super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
  }
};
var $ZodEncodeError = class extends Error {
  constructor(name) {
    super(`Encountered unidirectional transform during encode: ${name}`);
    this.name = "ZodEncodeError";
  }
};
(_a = globalThis).__zod_globalConfig ?? (_a.__zod_globalConfig = {});
var globalConfig = globalThis.__zod_globalConfig;
function config(newConfig) {
  if (newConfig)
    Object.assign(globalConfig, newConfig);
  return globalConfig;
}

// node_modules/zod/v4/core/errors.js
function _getMessage() {
  const internals = this._zod;
  internals.message ?? (internals.message = JSON.stringify(internals.def, jsonStringifyReplacer, 2));
  return internals.message;
}
function _setMessage(value) {
  this._zod.message = value;
}
var _messageDesc = {
  get: _getMessage,
  set: _setMessage,
  enumerable: true,
  configurable: true
};
var _issuesDesc = { value: void 0, enumerable: false };
var _installedToString = /* @__PURE__ */ new WeakSet([Object.prototype, Error.prototype]);
var initializer = (inst, def) => {
  inst.name = "$ZodError";
  _issuesDesc.value = def;
  Object.defineProperty(inst, "issues", _issuesDesc);
  _issuesDesc.value = void 0;
  Object.defineProperty(inst, "message", _messageDesc);
  const proto = Object.getPrototypeOf(inst);
  if (!_installedToString.has(proto)) {
    _installedToString.add(proto);
    Object.defineProperty(proto, "toString", {
      configurable: true,
      enumerable: false,
      get() {
        const value = () => this.message;
        Object.defineProperty(this, "toString", { value, configurable: true, writable: true });
        return value;
      },
      set(value) {
        Object.defineProperty(this, "toString", { value, configurable: true, writable: true });
      }
    });
  }
};
var $ZodError = $constructor("$ZodError", initializer);
var $ZodRealError = $constructor("$ZodError", initializer, void 0, {
  Parent: Error
});
function node(obj, key, make) {
  if (!Object.prototype.hasOwnProperty.call(obj, key)) {
    if (key === "__proto__") {
      Object.defineProperty(obj, key, { value: make(), writable: true, enumerable: true, configurable: true });
    } else {
      obj[key] = make();
    }
  }
  return obj[key];
}
function flattenError(error2, mapper = (issue2) => issue2.message) {
  const fieldErrors = {};
  const formErrors = [];
  for (const sub of error2.issues) {
    if (sub.path.length > 0) {
      node(fieldErrors, sub.path[0], () => []).push(mapper(sub));
    } else {
      formErrors.push(mapper(sub));
    }
  }
  return { formErrors, fieldErrors };
}
function formatError(error2, mapper = (issue2) => issue2.message) {
  const fieldErrors = { _errors: [] };
  const processError = (error3, path39 = []) => {
    for (const issue2 of error3.issues) {
      if (issue2.code === "invalid_union" && issue2.errors.length) {
        issue2.errors.map((issues) => processError({ issues }, [...path39, ...issue2.path]));
      } else if (issue2.code === "invalid_key") {
        processError({ issues: issue2.issues }, [...path39, ...issue2.path]);
      } else if (issue2.code === "invalid_element") {
        processError({ issues: issue2.issues }, [...path39, ...issue2.path]);
      } else {
        const fullpath = [...path39, ...issue2.path];
        if (fullpath.length === 0) {
          fieldErrors._errors.push(mapper(issue2));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < fullpath.length) {
            const el = fullpath[i];
            const terminal = i === fullpath.length - 1;
            if (el === "_errors") {
              if (terminal)
                curr._errors.push(mapper(issue2));
              i++;
              continue;
            }
            if (!Object.prototype.hasOwnProperty.call(curr, el)) {
              Object.defineProperty(curr, el, {
                value: { _errors: [] },
                enumerable: true,
                writable: true,
                configurable: true
              });
            }
            const node2 = curr[el];
            if (terminal) {
              node2._errors.push(mapper(issue2));
            }
            curr = node2;
            i++;
          }
        }
      }
    }
  };
  processError(error2);
  return fieldErrors;
}

// node_modules/zod/v4/core/parse.js
function finalizeParams(callee, params) {
  return { callee: params?.callee ?? callee, Err: params?.Err };
}
var _parse2 = (_Err) => {
  const fn = (schema, value, _ctx, _params) => {
    const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
    const result = schema._zod.run({ value, issues: [] }, ctx);
    if (result instanceof Promise) {
      throw new $ZodAsyncError();
    }
    if (result.issues.length) {
      const e = new (_params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
      captureStackTrace(e, _params?.callee ?? fn);
      throw e;
    }
    return result.value;
  };
  return fn;
};
var _parseAsync = (_Err) => {
  const fn = async (schema, value, _ctx, params) => {
    const ctx = _ctx ? { ..._ctx, async: true } : { async: true };
    let result = schema._zod.run({ value, issues: [] }, ctx);
    if (result instanceof Promise)
      result = await result;
    if (result.issues.length) {
      const e = new (params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
      captureStackTrace(e, params?.callee ?? fn);
      throw e;
    }
    return result.value;
  };
  return fn;
};
var _safeParse = (_Err) => (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
  const result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise) {
    throw new $ZodAsyncError();
  }
  return result.issues.length ? failure(_Err, result.issues, ctx) : { success: true, data: result.value };
};
function failure(Err, issues, ctx) {
  let error2;
  return {
    success: false,
    get error() {
      if (!error2) {
        error2 = new Err(issues.map((iss) => finalizeIssue(iss, ctx, config())));
        issues = void 0;
        ctx = void 0;
      }
      return error2;
    },
    set error(e) {
      error2 = e;
      issues = void 0;
      ctx = void 0;
    }
  };
}
var _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, async: true } : { async: true };
  let result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise)
    result = await result;
  return result.issues.length ? failure(_Err, result.issues, ctx) : { success: true, data: result.value };
};
var COMPILE_INVALID = /* @__PURE__ */ Symbol.for("zod.compile.invalid");
var COMPILE_FALLBACK = /* @__PURE__ */ Symbol.for("zod.compile.fallback");
var validate = ((schema, value, _ctx) => {
  const validator = schema._zod.bag.validator;
  if (validator !== void 0) {
    if (validator(value) !== COMPILE_INVALID)
      return true;
    if (validator.definite === true && _ctx === void 0)
      return false;
  }
  return validateFallback(schema, value, _ctx);
});
function validateFallback(schema, value, _ctx) {
  const ctx = _ctx ? { ..._ctx, async: false, abortEarly: true } : { async: false, abortEarly: true };
  const fallbackRun = schema._zod.bag.fallbackRun;
  let result;
  if (fallbackRun) {
    ctx[COMPILE_FALLBACK] = true;
    result = fallbackRun({ value, issues: [] }, ctx);
  } else {
    result = schema._zod.run({ value, issues: [] }, ctx);
  }
  if (result instanceof Promise) {
    throw new $ZodAsyncError();
  }
  return result.issues.length === 0;
}
var validateAsync = async (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, async: true, abortEarly: true } : { async: true, abortEarly: true };
  let result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise)
    result = await result;
  return result.issues.length === 0;
};
var _encode = (_Err) => {
  const parse7 = _parse2(_Err);
  const fn = (schema, value, _ctx, _params) => {
    const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
    return parse7(schema, value, ctx, finalizeParams(fn, _params));
  };
  return fn;
};
var _decode = (_Err) => {
  const parse7 = _parse2(_Err);
  const fn = (schema, value, _ctx, _params) => {
    return parse7(schema, value, _ctx, finalizeParams(fn, _params));
  };
  return fn;
};
var _encodeAsync = (_Err) => {
  const parseAsync2 = _parseAsync(_Err);
  const fn = async (schema, value, _ctx, _params) => {
    const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
    return await parseAsync2(schema, value, ctx, finalizeParams(fn, _params));
  };
  return fn;
};
var _decodeAsync = (_Err) => {
  const parseAsync2 = _parseAsync(_Err);
  const fn = async (schema, value, _ctx, _params) => {
    return await parseAsync2(schema, value, _ctx, finalizeParams(fn, _params));
  };
  return fn;
};
var _safeEncode = (_Err) => (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
  return _safeParse(_Err)(schema, value, ctx);
};
var _safeDecode = (_Err) => (schema, value, _ctx) => {
  return _safeParse(_Err)(schema, value, _ctx);
};
var _safeEncodeAsync = (_Err) => async (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
  return _safeParseAsync(_Err)(schema, value, ctx);
};
var _safeDecodeAsync = (_Err) => async (schema, value, _ctx) => {
  return _safeParseAsync(_Err)(schema, value, _ctx);
};

// node_modules/zod/v4/core/regexes.js
var cuid = /^[cC][0-9a-z]{6,}$/;
var cuid2 = /^[0-9a-z]+$/;
var ulid = /^[0-7][0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{25}$/;
var xid = /^[0-9a-vA-V]{20}$/;
var ksuid = /^[A-Za-z0-9]{27}$/;
var nanoid = /^[a-zA-Z0-9_-]{21}$/;
function nanoidOfLength(length) {
  return new RegExp(`^[a-zA-Z0-9_-]{${length}}$`);
}
var duration = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
var guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
var uuid = (version2) => {
  if (!version2)
    return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
  return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version2}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
};
var email = /^(?:[A-Za-z0-9_'+\-]+\.)*[A-Za-z0-9_'+\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
var _emoji = `^(?=[\\s\\S]*[\\p{Extended_Pictographic}\\p{Regional_Indicator}\\u20E3])[\\p{Extended_Pictographic}\\p{Emoji_Component}]+$`;
function emoji() {
  return new RegExp(_emoji, "u");
}
var ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
var cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
var cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
var base64url = /^(?:[A-Za-z0-9_-]{4})*(?:[A-Za-z0-9_-]{2,3})?$/;
var httpProtocol = /^https?$/;
var e164 = /^\+[1-9]\d{6,14}$/;
var dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;
function anchor(source) {
  return new RegExp(`^${source}$`);
}
var date = /* @__PURE__ */ anchor(dateSource);
function timeSource(args) {
  const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
  const regex = typeof args.precision === "number" ? args.precision === -1 ? `${hhmm}` : args.precision === 0 ? `${hhmm}:[0-5]\\d` : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}` : args.seconds ? `${hhmm}:[0-5]\\d(?:\\.\\d+)?` : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
  return regex;
}
function time(args) {
  return new RegExp(`^${timeSource(args)}$`);
}
function datetime(args) {
  const opts = ["Z"];
  if (args.offset)
    opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
  const qualified = `${timeSource({ precision: args.precision, seconds: true })}(?:${opts.join("|")})`;
  const timeRegex = args.local ? `${qualified}|${timeSource({ precision: args.precision })}` : qualified;
  return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
}
var anyString = /^[\s\S]{0,}$/;
var integer = /^-?\d+$/;
var number = /^-?\d+(?:\.\d+)?$/;
var boolean = /^(?:true|false)$/i;
var lowercase = /^[^A-Z]*$/;
var uppercase = /^[^a-z]*$/;

// node_modules/zod/v4/core/checks.js
var $ZodCheck = /* @__PURE__ */ $constructor("$ZodCheck", (inst, def) => {
  var _a3;
  inst._zod ?? (inst._zod = {});
  inst._zod.def = def;
  (_a3 = inst._zod).onattach ?? (_a3.onattach = []);
});
var _whenHasLength = (payload) => {
  const val = payload.value;
  return !nullish(val) && val.length !== void 0;
};
var numericOriginMap = {
  number: "number",
  bigint: "bigint",
  object: "date"
};
var $ZodCheckLessThan = /* @__PURE__ */ $constructor("$ZodCheckLessThan", (inst, def) => {
  $ZodCheck.init(inst, def);
  const origin = numericOriginMap[typeof def.value];
  inst._zod.check = (payload) => {
    if (def.inclusive ? payload.value <= def.value : payload.value < def.value) {
      return;
    }
    payload.issues.push({
      origin: numericOriginMap[typeof payload.value] ?? origin,
      code: "too_big",
      maximum: typeof def.value === "object" ? def.value.getTime() : def.value,
      input: payload.value,
      inclusive: def.inclusive,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckGreaterThan = /* @__PURE__ */ $constructor("$ZodCheckGreaterThan", (inst, def) => {
  $ZodCheck.init(inst, def);
  const origin = numericOriginMap[typeof def.value];
  inst._zod.check = (payload) => {
    if (def.inclusive ? payload.value >= def.value : payload.value > def.value) {
      return;
    }
    payload.issues.push({
      origin: numericOriginMap[typeof payload.value] ?? origin,
      code: "too_small",
      minimum: typeof def.value === "object" ? def.value.getTime() : def.value,
      input: payload.value,
      inclusive: def.inclusive,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckMultipleOf = /* @__PURE__ */ $constructor("$ZodCheckMultipleOf", (inst, def) => {
  $ZodCheck.init(inst, def);
  inst._zod.check = (payload) => {
    if (typeof payload.value !== typeof def.value)
      throw new Error("Cannot mix number and bigint in multiple_of check.");
    const isMultiple = typeof payload.value === "bigint" ? (
      // `value % 0n` throws, and nothing is a multiple of zero — the number branch already fails this way via NaN
      def.value !== BigInt(0) && payload.value % def.value === BigInt(0)
    ) : floatSafeRemainder(payload.value, def.value) === 0;
    if (isMultiple)
      return;
    payload.issues.push({
      origin: typeof payload.value,
      code: "not_multiple_of",
      divisor: def.value,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckNumberFormat = /* @__PURE__ */ $constructor("$ZodCheckNumberFormat", (inst, def) => {
  $ZodCheck.init(inst, def);
  def.format = def.format || "float64";
  const isInt = def.format?.includes("int");
  const origin = isInt ? "int" : "number";
  const [minimum, maximum] = NUMBER_FORMAT_RANGES[def.format];
  inst._zod.check = (payload) => {
    const input = payload.value;
    if (isInt) {
      if (!Number.isInteger(input)) {
        payload.issues.push({
          expected: origin,
          format: def.format,
          code: "invalid_type",
          continue: false,
          input,
          inst
        });
        return;
      }
      if (!Number.isSafeInteger(input)) {
        if (input > 0) {
          payload.issues.push({
            input,
            code: "too_big",
            maximum: Number.MAX_SAFE_INTEGER,
            note: "Integers must be within the safe integer range.",
            inst,
            origin,
            inclusive: true,
            continue: !def.abort
          });
        } else {
          payload.issues.push({
            input,
            code: "too_small",
            minimum: Number.MIN_SAFE_INTEGER,
            note: "Integers must be within the safe integer range.",
            inst,
            origin,
            inclusive: true,
            continue: !def.abort
          });
        }
        return;
      }
    }
    if (input < minimum) {
      payload.issues.push({
        origin: "number",
        input,
        code: "too_small",
        minimum,
        inclusive: true,
        inst,
        continue: !def.abort
      });
    }
    if (input > maximum) {
      payload.issues.push({
        origin: "number",
        input,
        code: "too_big",
        maximum,
        inclusive: true,
        inst,
        continue: !def.abort
      });
    }
  };
});
var $ZodCheckMaxLength = /* @__PURE__ */ $constructor("$ZodCheckMaxLength", (inst, def) => {
  var _a3;
  $ZodCheck.init(inst, def);
  (_a3 = inst._zod.def).when ?? (_a3.when = _whenHasLength);
  inst._zod.check = (payload) => {
    const input = payload.value;
    const units = input.length;
    const length = typeof input === "string" && units > def.maximum ? codePointLength(input) : units;
    if (length <= def.maximum)
      return;
    const origin = getLengthableOrigin(input);
    payload.issues.push({
      origin,
      code: "too_big",
      maximum: def.maximum,
      inclusive: true,
      input,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckMinLength = /* @__PURE__ */ $constructor("$ZodCheckMinLength", (inst, def) => {
  var _a3;
  $ZodCheck.init(inst, def);
  (_a3 = inst._zod.def).when ?? (_a3.when = _whenHasLength);
  inst._zod.check = (payload) => {
    const input = payload.value;
    const units = input.length;
    const length = typeof input === "string" && units >= def.minimum && units < def.minimum * 2 ? codePointLength(input) : units;
    if (length >= def.minimum)
      return;
    const origin = getLengthableOrigin(input);
    payload.issues.push({
      origin,
      code: "too_small",
      minimum: def.minimum,
      inclusive: true,
      input,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckLengthEquals = /* @__PURE__ */ $constructor("$ZodCheckLengthEquals", (inst, def) => {
  var _a3;
  $ZodCheck.init(inst, def);
  (_a3 = inst._zod.def).when ?? (_a3.when = _whenHasLength);
  inst._zod.check = (payload) => {
    const input = payload.value;
    const units = input.length;
    const length = typeof input === "string" && units >= def.length && units <= def.length * 2 ? codePointLength(input) : units;
    if (length === def.length)
      return;
    const origin = getLengthableOrigin(input);
    const tooBig = length > def.length;
    payload.issues.push({
      origin,
      ...tooBig ? { code: "too_big", maximum: def.length } : { code: "too_small", minimum: def.length },
      inclusive: true,
      exact: true,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckStringFormat = /* @__PURE__ */ $constructor("$ZodCheckStringFormat", (inst, def) => {
  var _a3, _b;
  $ZodCheck.init(inst, def);
  if (def.pattern)
    (_a3 = inst._zod).check ?? (_a3.check = (payload) => {
      def.pattern.lastIndex = 0;
      if (def.pattern.test(payload.value))
        return;
      payload.issues.push({
        origin: "string",
        code: "invalid_format",
        format: def.format,
        input: payload.value,
        ...def.pattern ? { pattern: def.pattern.toString() } : {},
        inst,
        continue: !def.abort
      });
    });
  else
    (_b = inst._zod).check ?? (_b.check = () => {
    });
});
var $ZodCheckRegex = /* @__PURE__ */ $constructor("$ZodCheckRegex", (inst, def) => {
  $ZodCheckStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    def.pattern.lastIndex = 0;
    if (def.pattern.test(payload.value))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "regex",
      input: payload.value,
      pattern: def.pattern.toString(),
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckLowerCase = /* @__PURE__ */ $constructor("$ZodCheckLowerCase", (inst, def) => {
  def.pattern ?? (def.pattern = lowercase);
  $ZodCheckStringFormat.init(inst, def);
});
var $ZodCheckUpperCase = /* @__PURE__ */ $constructor("$ZodCheckUpperCase", (inst, def) => {
  def.pattern ?? (def.pattern = uppercase);
  $ZodCheckStringFormat.init(inst, def);
});
var $ZodCheckIncludes = /* @__PURE__ */ $constructor("$ZodCheckIncludes", (inst, def) => {
  $ZodCheck.init(inst, def);
  const escapedRegex = escapeRegex(def.includes);
  const pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position},}${escapedRegex}` : escapedRegex);
  def.pattern = pattern;
  inst._zod.check = (payload) => {
    if (payload.value.includes(def.includes, def.position))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "includes",
      includes: def.includes,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckStartsWith = /* @__PURE__ */ $constructor("$ZodCheckStartsWith", (inst, def) => {
  $ZodCheck.init(inst, def);
  const pattern = new RegExp(`^${escapeRegex(def.prefix)}.*`);
  def.pattern ?? (def.pattern = pattern);
  inst._zod.check = (payload) => {
    if (payload.value.startsWith(def.prefix))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "starts_with",
      prefix: def.prefix,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckEndsWith = /* @__PURE__ */ $constructor("$ZodCheckEndsWith", (inst, def) => {
  $ZodCheck.init(inst, def);
  const pattern = new RegExp(`.*${escapeRegex(def.suffix)}$`);
  def.pattern ?? (def.pattern = pattern);
  inst._zod.check = (payload) => {
    if (payload.value.endsWith(def.suffix))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "ends_with",
      suffix: def.suffix,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckOverwrite = /* @__PURE__ */ $constructor("$ZodCheckOverwrite", (inst, def) => {
  $ZodCheck.init(inst, def);
  inst._zod.check = (payload) => {
    payload.value = def.tx(payload.value);
  };
});

// node_modules/zod/v4/core/doc.js
var Doc = class {
  constructor(args = [], closed = {}) {
    this.content = [];
    this.indent = 0;
    this.args = args;
    this.closed = closed;
  }
  // the compiler catches a child's throw and keeps writing into this doc, so the indent has to unwind with it
  indented(fn) {
    this.indent += 1;
    try {
      fn(this);
    } finally {
      this.indent -= 1;
    }
  }
  write(arg) {
    if (typeof arg === "function") {
      arg(this, { execution: "sync" });
      arg(this, { execution: "async" });
      return;
    }
    const content = arg;
    const lines = content.split("\n").filter((x) => x);
    const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
    const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
    for (const line of dedented) {
      this.content.push(line);
    }
  }
  compile() {
    const F = Function;
    const content = this?.content ?? [``];
    const factory = new F(...Object.keys(this.closed), `return function (${this.args.join(", ")}) {
${content.join("\n")}
};`);
    return factory(...Object.values(this.closed));
  }
};

// node_modules/zod/v4/core/versions.js
var version = {
  major: 4,
  minor: 6,
  patch: 7
};

// node_modules/zod/v4/core/schemas.js
var $ZodType = /* @__PURE__ */ $constructor("$ZodType", (inst, def) => {
  var _a3;
  inst ?? (inst = {});
  inst._zod.def = def;
  inst._zod.bag = inst._zod.bag || {};
  inst._zod.version = version;
  const defChecks = inst._zod.def.checks;
  const checks = inst._zod.traits.has("$ZodCheck") ? [inst, ...defChecks ?? []] : defChecks?.length ? [...defChecks] : [];
  for (const ch of checks) {
    for (const fn of ch._zod.onattach) {
      fn(inst);
    }
  }
  if (checks.length === 0) {
    (_a3 = inst._zod).deferred ?? (_a3.deferred = []);
    inst._zod.deferred?.push(() => {
      inst._zod.run = inst._zod.parse;
    });
  } else {
    const runChecks = (payload, checks2, ctx) => {
      if (payload.memo)
        return payload;
      let isAborted = aborted(payload);
      let asyncResult;
      for (const ch of checks2) {
        if (ch._zod.def.when) {
          if (explicitlyAborted(payload))
            continue;
          const shouldRun = ch._zod.def.when(payload);
          if (!shouldRun)
            continue;
        } else if (isAborted) {
          continue;
        }
        const currLen = payload.issues.length;
        const _ = ch._zod.check(payload);
        if (_ instanceof Promise && ctx?.async === false) {
          throw new $ZodAsyncError();
        }
        if (asyncResult || _ instanceof Promise) {
          asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
            await _;
            const nextLen = payload.issues.length;
            if (nextLen === currLen)
              return;
            attachSchema(payload.issues, currLen, inst);
            if (!isAborted)
              isAborted = aborted(payload, currLen);
          });
        } else {
          const nextLen = payload.issues.length;
          if (nextLen === currLen)
            continue;
          attachSchema(payload.issues, currLen, inst);
          if (!isAborted)
            isAborted = aborted(payload, currLen);
        }
      }
      if (asyncResult) {
        return asyncResult.then(() => {
          return payload;
        });
      }
      return payload;
    };
    const handleCanaryResult = (canary, payload, ctx) => {
      if (aborted(canary)) {
        canary.aborted = true;
        return canary;
      }
      const checkResult = runChecks(payload, checks, ctx);
      if (checkResult instanceof Promise) {
        if (ctx.async === false)
          throw new $ZodAsyncError();
        return checkResult.then((checkResult2) => inst._zod.parse(checkResult2, ctx));
      }
      return inst._zod.parse(checkResult, ctx);
    };
    inst._zod.run = (payload, ctx) => {
      if (ctx.skipChecks) {
        return inst._zod.parse(payload, ctx);
      }
      if (ctx.direction === "backward") {
        const canary = inst._zod.parse({ value: payload.value, issues: [] }, { ...ctx, skipChecks: true });
        if (canary instanceof Promise) {
          return canary.then((canary2) => {
            return handleCanaryResult(canary2, payload, ctx);
          });
        }
        return handleCanaryResult(canary, payload, ctx);
      }
      const result = inst._zod.parse(payload, ctx);
      if (result instanceof Promise) {
        if (ctx.async === false)
          throw new $ZodAsyncError();
        return result.then((result2) => runChecks(result2, checks, ctx));
      }
      return runChecks(result, checks, ctx);
    };
  }
}, {
  // Wrappers extend this by installing a richer factory over it; reading it eagerly would defeat the laziness.
  get "~standard"() {
    return hide(this, "~standard", standardProps(this));
  },
  set "~standard"(value) {
    own(this, "~standard", value);
  }
});
var toStandardResult = (r, ctx) => r.issues.length ? { issues: r.issues.map((iss) => finalizeIssue(iss, ctx, config())) } : { value: r.value };
async function validateAsync2(inst, value) {
  const ctx = { async: true };
  return toStandardResult(await inst._zod.run({ value, issues: [] }, ctx), ctx);
}
function standardProps(inst) {
  return {
    validate: (value) => {
      const ctx = { async: false };
      try {
        const r = inst._zod.run({ value, issues: [] }, ctx);
        if (!(r instanceof Promise))
          return toStandardResult(r, ctx);
      } catch (_) {
      }
      return validateAsync2(inst, value);
    },
    vendor: "zod",
    version: 1
  };
}
var $ZodString = /* @__PURE__ */ $constructor("$ZodString", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = def.pattern ?? anyString;
  inst._zod.parse = (payload, _) => {
    if (def.coerce)
      try {
        payload.value = String(payload.value);
      } catch (_2) {
      }
    if (typeof payload.value === "string")
      return payload;
    payload.issues.push({
      expected: "string",
      code: "invalid_type",
      input: payload.value,
      inst
    });
    return payload;
  };
});
var $ZodStringFormat = /* @__PURE__ */ $constructor("$ZodStringFormat", (inst, def) => {
  $ZodCheckStringFormat.init(inst, def);
  $ZodString.init(inst, def);
});
var $ZodGUID = /* @__PURE__ */ $constructor("$ZodGUID", (inst, def) => {
  def.pattern ?? (def.pattern = guid);
  $ZodStringFormat.init(inst, def);
});
var $ZodUUID = /* @__PURE__ */ $constructor("$ZodUUID", (inst, def) => {
  if (def.version) {
    const versionMap = {
      v1: 1,
      v2: 2,
      v3: 3,
      v4: 4,
      v5: 5,
      v6: 6,
      v7: 7,
      v8: 8
    };
    const v = versionMap[def.version];
    if (v === void 0)
      throw new Error(`Invalid UUID version: "${def.version}"`);
    def.pattern ?? (def.pattern = uuid(v));
  } else
    def.pattern ?? (def.pattern = uuid());
  $ZodStringFormat.init(inst, def);
});
var $ZodEmail = /* @__PURE__ */ $constructor("$ZodEmail", (inst, def) => {
  def.pattern ?? (def.pattern = email);
  $ZodStringFormat.init(inst, def);
});
var URL_BAD_FORMAT = 1;
var URL_UNPARSEABLE = 2;
function canParseURL(input) {
  try {
    if (typeof URL !== "undefined" && typeof URL.canParse === "function")
      return URL.canParse(input);
    new URL(input);
    return true;
  } catch {
    return false;
  }
}
function validateURL(trimmed, def) {
  if (!("normalize" in def) && !("hostname" in def) && !("protocol" in def)) {
    return canParseURL(trimmed) || URL_UNPARSEABLE;
  }
  return parseURLObject(trimmed, def);
}
function parseURLObject(trimmed, def) {
  if (!def.normalize && def.protocol?.source === httpProtocol.source && !/^https?:\/\//i.test(trimmed)) {
    return URL_BAD_FORMAT;
  }
  try {
    if (typeof URL !== "undefined") {
      const URLStatic = URL;
      if (typeof URLStatic.parse === "function")
        return URLStatic.parse(trimmed) ?? URL_UNPARSEABLE;
    }
    return new URL(trimmed);
  } catch {
    return URL_UNPARSEABLE;
  }
}
var asciiTabOrNewline = /[\t\n\r]/g;
function stripTabAndNewline(value) {
  return value.replace(asciiTabOrNewline, "");
}
function urlHostnameOk(url, hostname) {
  hostname.lastIndex = 0;
  return hostname.test(url.hostname);
}
function urlProtocolOk(url, protocol) {
  protocol.lastIndex = 0;
  return protocol.test(url.protocol.endsWith(":") ? url.protocol.slice(0, -1) : url.protocol);
}
var $ZodURL = /* @__PURE__ */ $constructor("$ZodURL", (inst, def) => {
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    try {
      const trimmed = payload.value.trim();
      const url = validateURL(trimmed, def);
      if (url === URL_BAD_FORMAT) {
        payload.issues.push({
          code: "invalid_format",
          format: "url",
          note: "Invalid URL format",
          input: payload.value,
          inst,
          continue: !def.abort
        });
        return;
      }
      if (url === URL_UNPARSEABLE) {
        payload.issues.push({
          code: "invalid_format",
          format: "url",
          input: payload.value,
          inst,
          continue: !def.abort
        });
        return;
      }
      if (url === true) {
        payload.value = stripTabAndNewline(trimmed);
        return;
      }
      if (def.hostname && !urlHostnameOk(url, def.hostname)) {
        payload.issues.push({
          code: "invalid_format",
          format: "url",
          note: "Invalid hostname",
          pattern: def.hostname.source,
          input: payload.value,
          inst,
          continue: !def.abort
        });
      }
      if (def.protocol && !urlProtocolOk(url, def.protocol)) {
        payload.issues.push({
          code: "invalid_format",
          format: "url",
          note: "Invalid protocol",
          pattern: def.protocol.source,
          input: payload.value,
          inst,
          continue: !def.abort
        });
      }
      payload.value = def.normalize ? url.href : stripTabAndNewline(trimmed);
      return;
    } catch (_) {
      payload.issues.push({
        code: "invalid_format",
        format: "url",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    }
  };
});
var $ZodEmoji = /* @__PURE__ */ $constructor("$ZodEmoji", (inst, def) => {
  def.pattern ?? (def.pattern = emoji());
  $ZodStringFormat.init(inst, def);
});
var $ZodNanoID = /* @__PURE__ */ $constructor("$ZodNanoID", (inst, def) => {
  if (def.length !== void 0 && (!Number.isInteger(def.length) || def.length < 1))
    throw new Error(`Invalid nanoid length: ${def.length}`);
  def.pattern ?? (def.pattern = def.length === void 0 ? nanoid : nanoidOfLength(def.length));
  $ZodStringFormat.init(inst, def);
});
var $ZodCUID = /* @__PURE__ */ $constructor("$ZodCUID", (inst, def) => {
  def.pattern ?? (def.pattern = cuid);
  $ZodStringFormat.init(inst, def);
});
var $ZodCUID2 = /* @__PURE__ */ $constructor("$ZodCUID2", (inst, def) => {
  def.pattern ?? (def.pattern = cuid2);
  $ZodStringFormat.init(inst, def);
});
var $ZodULID = /* @__PURE__ */ $constructor("$ZodULID", (inst, def) => {
  def.pattern ?? (def.pattern = ulid);
  $ZodStringFormat.init(inst, def);
});
var $ZodXID = /* @__PURE__ */ $constructor("$ZodXID", (inst, def) => {
  def.pattern ?? (def.pattern = xid);
  $ZodStringFormat.init(inst, def);
});
var $ZodKSUID = /* @__PURE__ */ $constructor("$ZodKSUID", (inst, def) => {
  def.pattern ?? (def.pattern = ksuid);
  $ZodStringFormat.init(inst, def);
});
var $ZodISODateTime = /* @__PURE__ */ $constructor("$ZodISODateTime", (inst, def) => {
  def.pattern ?? (def.pattern = datetime(def));
  $ZodStringFormat.init(inst, def);
});
var $ZodISODate = /* @__PURE__ */ $constructor("$ZodISODate", (inst, def) => {
  def.pattern ?? (def.pattern = date);
  $ZodStringFormat.init(inst, def);
});
var $ZodISOTime = /* @__PURE__ */ $constructor("$ZodISOTime", (inst, def) => {
  def.pattern ?? (def.pattern = time(def));
  $ZodStringFormat.init(inst, def);
});
var $ZodISODuration = /* @__PURE__ */ $constructor("$ZodISODuration", (inst, def) => {
  def.pattern ?? (def.pattern = duration);
  $ZodStringFormat.init(inst, def);
});
var $ZodIPv4 = /* @__PURE__ */ $constructor("$ZodIPv4", (inst, def) => {
  def.pattern ?? (def.pattern = ipv4);
  $ZodStringFormat.init(inst, def);
});
var ipv6Alphabet = /^[0-9a-fA-F:.]+$/;
function isValidIPv6(value) {
  if (!ipv6Alphabet.test(value))
    return false;
  return canParseURL(`http://[${value}]`);
}
var $ZodIPv6 = /* @__PURE__ */ $constructor("$ZodIPv6", (inst, def) => {
  def.pattern ?? (def.pattern = ipv6);
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    if (!isValidIPv6(payload.value)) {
      payload.issues.push({
        code: "invalid_format",
        format: "ipv6",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    }
  };
});
var $ZodCIDRv4 = /* @__PURE__ */ $constructor("$ZodCIDRv4", (inst, def) => {
  def.pattern ?? (def.pattern = cidrv4);
  $ZodStringFormat.init(inst, def);
});
function isValidCIDRv6(value) {
  const parts = value.split("/");
  if (parts.length !== 2)
    return false;
  const [address, prefix] = parts;
  if (!prefix)
    return false;
  const prefixNum = Number(prefix);
  if (`${prefixNum}` !== prefix)
    return false;
  if (prefixNum < 0 || prefixNum > 128)
    return false;
  return isValidIPv6(address);
}
var $ZodCIDRv6 = /* @__PURE__ */ $constructor("$ZodCIDRv6", (inst, def) => {
  def.pattern ?? (def.pattern = cidrv6);
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    if (!isValidCIDRv6(payload.value)) {
      payload.issues.push({
        code: "invalid_format",
        format: "cidrv6",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    }
  };
});
function isValidBase64(data) {
  if (data === "")
    return true;
  if (/\s/.test(data))
    return false;
  if (data.length % 4 !== 0)
    return false;
  try {
    atob(data);
    return true;
  } catch {
    return false;
  }
}
var base64Charset = /^[0-9a-zA-Z+/]*={0,2}$/;
var $ZodBase64 = /* @__PURE__ */ $constructor("$ZodBase64", (inst, def) => {
  def.pattern ?? (def.pattern = base64Charset);
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    if (isValidBase64(payload.value))
      return;
    payload.issues.push({
      code: "invalid_format",
      format: "base64",
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var base64urlCharset = /^[A-Za-z0-9_-]*$/;
function isValidBase64URL(data) {
  if (!base64urlCharset.test(data))
    return false;
  const base642 = data.replace(/[-_]/g, (c) => c === "-" ? "+" : "/");
  const padded = base642.padEnd(Math.ceil(base642.length / 4) * 4, "=");
  return isValidBase64(padded);
}
var $ZodBase64URL = /* @__PURE__ */ $constructor("$ZodBase64URL", (inst, def) => {
  def.pattern ?? (def.pattern = base64urlCharset);
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    if (isValidBase64URL(payload.value))
      return;
    payload.issues.push({
      code: "invalid_format",
      format: "base64url",
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodE164 = /* @__PURE__ */ $constructor("$ZodE164", (inst, def) => {
  def.pattern ?? (def.pattern = e164);
  $ZodStringFormat.init(inst, def);
});
function isValidJWT(token, algorithm = null) {
  try {
    const tokensParts = token.split(".");
    if (tokensParts.length !== 3)
      return false;
    const [header] = tokensParts;
    if (!header)
      return false;
    const parsedHeader = JSON.parse(atob(header));
    if ("typ" in parsedHeader && parsedHeader?.typ !== "JWT")
      return false;
    if (!parsedHeader.alg)
      return false;
    if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm))
      return false;
    return true;
  } catch {
    return false;
  }
}
var $ZodJWT = /* @__PURE__ */ $constructor("$ZodJWT", (inst, def) => {
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    if (isValidJWT(payload.value, def.alg))
      return;
    payload.issues.push({
      code: "invalid_format",
      format: "jwt",
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodNumber = /* @__PURE__ */ $constructor("$ZodNumber", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = number;
  inst._zod.parse = (payload, _ctx) => {
    if (def.coerce)
      try {
        payload.value = Number(payload.value);
      } catch (_) {
      }
    const input = payload.value;
    if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) {
      return payload;
    }
    const received = typeof input === "number" ? Number.isNaN(input) ? "NaN" : !Number.isFinite(input) ? String(input) : void 0 : void 0;
    payload.issues.push({
      expected: "number",
      code: "invalid_type",
      input,
      inst,
      ...received ? { received } : {}
    });
    return payload;
  };
});
var $ZodNumberFormat = /* @__PURE__ */ $constructor("$ZodNumberFormat", (inst, def) => {
  $ZodCheckNumberFormat.init(inst, def);
  $ZodNumber.init(inst, def);
});
var $ZodBoolean = /* @__PURE__ */ $constructor("$ZodBoolean", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = boolean;
  inst._zod.parse = (payload, _ctx) => {
    if (def.coerce)
      try {
        payload.value = Boolean(payload.value);
      } catch (_) {
      }
    const input = payload.value;
    if (typeof input === "boolean")
      return payload;
    payload.issues.push({
      expected: "boolean",
      code: "invalid_type",
      input,
      inst
    });
    return payload;
  };
});
var $ZodUnknown = /* @__PURE__ */ $constructor("$ZodUnknown", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload) => payload;
});
var $ZodNever = /* @__PURE__ */ $constructor("$ZodNever", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, _ctx) => {
    payload.issues.push({
      expected: "never",
      code: "invalid_type",
      input: payload.value,
      inst
    });
    return payload;
  };
});
function capSize(inst, size) {
  const caps = sizeCaps(inst._zod.def.checks);
  if (!caps.length)
    return;
  const cap = Math.min(...caps.map((c) => c[0]));
  const parse7 = inst._zod.parse;
  inst._zod.parse = (payload, ctx) => {
    const n = size(payload.value);
    if (n > cap && !ctx?.skipChecks && ctx?.direction !== "backward") {
      for (const [max, ch] of sizeCaps(inst._zod.def.checks)) {
        if (n > max && ch._zod.def.when(payload)) {
          const start = payload.issues.length;
          ch._zod.check(payload);
          payload.issues[start].continue = false;
          attachSchema(payload.issues, start, inst);
          return payload;
        }
      }
    }
    return parse7(payload, ctx);
  };
}
var arraySize = (input) => Array.isArray(input) ? input.length : -1;
function handleArrayResult(result, final, index) {
  if (result.issues.length) {
    final.issues.push(...prefixIssues(index, result.issues));
  }
  final.value[index] = result.value;
}
var $ZodArray = /* @__PURE__ */ $constructor("$ZodArray", (inst, def) => {
  $ZodType.init(inst, def);
  const memo2 = globalConfig.memoizer;
  memo2?.attach(inst);
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    if (!Array.isArray(input)) {
      payload.issues.push({
        expected: "array",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    payload.value = memo2 ? memo2.alloc(inst, payload, Array(input.length), ctx) : Array(input.length);
    const proms = [];
    const abortEarly = ctx?.abortEarly;
    for (let i = 0; i < input.length; i++) {
      const item = input[i];
      const result = def.element._zod.run({
        value: item,
        issues: []
      }, ctx);
      if (result instanceof Promise) {
        proms.push(result.then((result2) => handleArrayResult(result2, payload, i)));
      } else {
        handleArrayResult(result, payload, i);
        if (abortEarly && result.issues.length !== 0 && aborted(result))
          break;
      }
    }
    if (proms.length) {
      return Promise.all(proms).then(() => payload);
    }
    return payload;
  };
  capSize(inst, arraySize);
});
function handlePropertyResult(result, final, key, input, optin, optout) {
  const isPresent = key in input;
  const isOptionalOut = optout === "optional";
  if (!isPresent && isOptionalOut && optin === "optional") {
    return;
  }
  if (result.issues.length) {
    if (optin !== void 0 && isOptionalOut && !isPresent) {
      return;
    }
    final.issues.push(...prefixIssues(key, result.issues));
  }
  if (!isPresent && optin === void 0) {
    if (!result.issues.length) {
      final.issues.push({
        code: "invalid_type",
        expected: "nonoptional",
        input: void 0,
        path: [key]
      });
    }
    return;
  }
  if (result.value === void 0) {
    if (isPresent || optin === "defaulted" && !isOptionalOut) {
      final.value[key] = void 0;
    }
  } else {
    final.value[key] = result.value;
  }
}
var NO_SYMBOL_KEYS = [];
function normalizeDef(def) {
  const keys = Object.keys(def.shape);
  const ownSymbols = Object.getOwnPropertySymbols(def.shape);
  const symbolKeys = ownSymbols.length ? ownSymbols : NO_SYMBOL_KEYS;
  const allKeys = symbolKeys.length ? [...keys, ...symbolKeys] : keys;
  for (const k of allKeys) {
    if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) {
      throw new Error(`Invalid element at key "${String(k)}": expected a Zod schema`);
    }
  }
  const okeys = optionalKeys(def.shape);
  return {
    ...def,
    allKeys,
    symbolKeys,
    // string-only: handleCatchall matches it against `for...in`, which never yields a symbol
    keySet: new Set(keys),
    numKeys: keys.length,
    optionalKeys: new Set(okeys)
  };
}
function handleCatchall(proms, input, payload, ctx, def, inst, abortEarly) {
  const unrecognized = [];
  const keySet = def.keySet;
  const _catchall = def.catchall._zod;
  const t = _catchall.def.type;
  const optin = _catchall.optin;
  const optout = _catchall.optout;
  let seen = 0;
  for (const key in input) {
    if (abortEarly && payload.issues.length !== seen) {
      if (aborted(payload, seen))
        break;
      seen = payload.issues.length;
    }
    if (keySet.has(key))
      continue;
    if (key === "__proto__") {
      if (t === "never")
        unrecognized.push(key);
      continue;
    }
    if (t === "never") {
      unrecognized.push(key);
      continue;
    }
    const r = _catchall.run({ value: input[key], issues: [] }, ctx);
    if (r instanceof Promise) {
      proms.push(r.then((r2) => handlePropertyResult(r2, payload, key, input, optin, optout)));
    } else {
      handlePropertyResult(r, payload, key, input, optin, optout);
    }
  }
  if (unrecognized.length) {
    payload.issues.push({
      code: "unrecognized_keys",
      keys: unrecognized,
      input,
      inst,
      // Describes the shape of the input, not the validity of the parsed value, so it never aborts. The parse still fails; the schema's own checks just get to run first, and an enclosing intersection can reconcile the key against a sibling operand.
      continue: true
    });
  }
  if (!proms.length)
    return payload;
  return Promise.all(proms).then(() => {
    return payload;
  });
}
var $ZodObject = /* @__PURE__ */ $constructor("$ZodObject", (inst, def) => {
  $ZodType.init(inst, def);
  const desc = Object.getOwnPropertyDescriptor(def, "shape");
  const sh = desc?.get ? desc.get.raw : def.shape ?? {};
  if (sh) {
    const get = () => {
      const newSh = { ...sh };
      Object.defineProperty(def, "shape", { value: newSh });
      get.raw = newSh;
      return newSh;
    };
    get.raw = sh;
    Object.defineProperty(def, "shape", { get });
  }
  const _normalized = cached(() => normalizeDef(def));
  defineLazyInternal(inst, "propValues", (zod) => {
    const shape = zod.def.shape;
    const propValues = {};
    for (const key in shape) {
      const field = shape[key]._zod;
      if (field.values) {
        if (!Object.prototype.hasOwnProperty.call(propValues, key)) {
          assignProp(propValues, key, /* @__PURE__ */ new Set());
        }
        for (const v of field.values)
          propValues[key].add(v);
        if (field.optin !== void 0)
          propValues[key].add(void 0);
      }
    }
    return propValues;
  });
  const isObject2 = isObject;
  const catchall = def.catchall;
  let value;
  const memo2 = globalConfig.memoizer;
  memo2?.attach(inst);
  inst._zod.parse = (payload, ctx) => {
    value ?? (value = _normalized.value);
    const input = payload.value;
    if (!isObject2(input)) {
      payload.issues.push({
        expected: "object",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    payload.value = memo2 ? memo2.alloc(inst, payload, {}, ctx) : {};
    const proms = [];
    const shape = value.shape;
    const abortEarly = ctx?.abortEarly;
    let seen = payload.issues.length;
    for (const key of value.allKeys) {
      if (abortEarly && payload.issues.length !== seen) {
        if (aborted(payload, seen))
          break;
        seen = payload.issues.length;
      }
      if (key === "__proto__")
        continue;
      const el = shape[key];
      const optin = el._zod.optin;
      const optout = el._zod.optout;
      const r = el._zod.run({ value: input[key], issues: [] }, ctx);
      if (r instanceof Promise) {
        proms.push(r.then((r2) => handlePropertyResult(r2, payload, key, input, optin, optout)));
      } else {
        handlePropertyResult(r, payload, key, input, optin, optout);
      }
    }
    if (!catchall) {
      return proms.length ? Promise.all(proms).then(() => payload) : payload;
    }
    return handleCatchall(proms, input, payload, ctx, _normalized.value, inst, abortEarly === true);
  };
});
var $ZodObjectJIT = /* @__PURE__ */ $constructor("$ZodObjectJIT", (inst, def) => {
  $ZodObject.init(inst, def);
  const superParse = inst._zod.parse;
  const _normalized = cached(() => normalizeDef(def));
  const memo2 = globalConfig.memoizer;
  const generateFastpass = (shape) => {
    const normalized = _normalized.value;
    const syms = normalized.symbolKeys;
    const doc = new Doc(["payload", "ctx"], { shape, inst, memo: memo2, syms });
    const parseStr = (k) => `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
    const prefixStr = (id, k) => `
          let ${id}_ab = false;
          for (let i = 0; i < ${id}.issues.length; i++) {
            const iss = ${id}.issues[i];
            iss.path = iss.path ? [${k}, ...iss.path] : [${k}];
            payload.issues.push(iss);
            if (iss.continue !== true) ${id}_ab = true;
          }
          if (${id}_ab && ctx && ctx.abortEarly) {
            payload.value = newResult;
            return payload;
          }`;
    doc.write(`const input = payload.value;`);
    const ids = /* @__PURE__ */ Object.create(null);
    let counter = 0;
    for (const key of normalized.allKeys) {
      ids[key] = `key_${counter++}`;
    }
    doc.write(memo2 ? `const newResult = memo.alloc(inst, payload, {}, ctx);` : `const newResult = {};`);
    for (const key of normalized.allKeys) {
      if (key === "__proto__")
        continue;
      const id = ids[key];
      const k = typeof key === "symbol" ? `syms[${syms.indexOf(key)}]` : esc(key);
      const isPresent = `${k} in input`;
      const schema = shape[key];
      const optin = schema?._zod?.optin;
      const isOptionalIn = optin !== void 0;
      const isOptionalOut = schema?._zod?.optout === "optional";
      doc.write(`const ${id} = ${parseStr(k)};`);
      if (isOptionalIn && isOptionalOut) {
        const assign = optin === "optional" ? `${id}_present` : `${id}.value !== undefined || ${id}_present`;
        doc.write(`
        const ${id}_present = ${isPresent};
        if (!${id}.issues.length || ${id}_present) {
          if (${id}.issues.length) {${prefixStr(id, k)}
          }

          if (${assign}) {
            newResult[${k}] = ${id}.value;
          }
        }

      `);
      } else if (!isOptionalIn) {
        doc.write(`
        const ${id}_present = ${isPresent};
        if (${id}.issues.length) {${prefixStr(id, k)}
        }
        if (!${id}_present && !${id}.issues.length) {
          payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: undefined,
            path: [${k}]
          });
          if (ctx && ctx.abortEarly) {
            payload.value = newResult;
            return payload;
          }
        }

        if (${id}_present) {
          newResult[${k}] = ${id}.value;
        }

      `);
      } else {
        doc.write(`
        if (${id}.issues.length) {${prefixStr(id, k)}
        }
      `);
        if (optin === "defaulted") {
          doc.write(`newResult[${k}] = ${id}.value;`);
        } else {
          doc.write(`
        if (${id}.value !== undefined || ${isPresent}) {
          newResult[${k}] = ${id}.value;
        }
      `);
        }
      }
    }
    doc.write(`payload.value = newResult;`);
    doc.write(`return payload;`);
    return doc.compile();
  };
  let fastpass;
  const isObject2 = isObject;
  const jit = !globalConfig.jitless;
  const allowsEval2 = allowsEval;
  const fastEnabled = jit && allowsEval2.value;
  const catchall = def.catchall;
  let value;
  inst._zod.parse = (payload, ctx) => {
    value ?? (value = _normalized.value);
    const input = payload.value;
    if (!isObject2(input)) {
      payload.issues.push({
        expected: "object",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    if (jit && fastEnabled && ctx?.async === false && ctx.jitless !== true) {
      if (!fastpass)
        fastpass = generateFastpass(def.shape);
      payload = fastpass(payload, ctx);
      if (!catchall)
        return payload;
      return handleCatchall([], input, payload, ctx, value, inst, ctx?.abortEarly === true);
    }
    return superParse(payload, ctx);
  };
});
function handleUnionResults(results, final, inst, ctx) {
  for (const result of results) {
    if (result.issues.length === 0) {
      final.value = result.value;
      return final;
    }
  }
  const nonaborted = results.filter((r) => !aborted(r));
  if (nonaborted.length === 1) {
    final.value = nonaborted[0].value;
    return nonaborted[0];
  }
  final.issues.push({
    code: "invalid_union",
    input: final.value,
    inst,
    errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  });
  return final;
}
var $ZodUnion = /* @__PURE__ */ $constructor("$ZodUnion", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazyInternal(inst, "optin", (zod) => zod.def.options.some((o) => o._zod.optin === "defaulted") ? "defaulted" : zod.def.options.some((o) => o._zod.optin !== void 0) ? "optional" : void 0);
  defineLazyInternal(inst, "optout", (zod) => zod.def.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0);
  defineLazyInternal(inst, "values", (zod) => {
    if (zod.def.options.every((o) => o._zod.values)) {
      return new Set(zod.def.options.flatMap((option) => Array.from(option._zod.values)));
    }
    return void 0;
  });
  defineLazyInternal(inst, "pattern", (zod) => {
    if (zod.def.options.every((o) => o._zod.pattern)) {
      const patterns = zod.def.options.map((o) => o._zod.pattern);
      return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
    }
    return void 0;
  });
  const first = def.options.length === 1 ? def.options[0]._zod.run : null;
  inst._zod.parse = (payload, ctx) => {
    if (first) {
      return first(payload, ctx);
    }
    let async = false;
    const results = [];
    for (const option of def.options) {
      const result = option._zod.run({
        value: payload.value,
        issues: []
      }, ctx);
      if (result instanceof Promise) {
        results.push(result);
        async = true;
      } else {
        if (result.issues.length === 0)
          return result;
        results.push(result);
      }
    }
    if (!async)
      return handleUnionResults(results, payload, inst, ctx);
    return Promise.all(results).then((results2) => {
      return handleUnionResults(results2, payload, inst, ctx);
    });
  };
});
var $ZodIntersection = /* @__PURE__ */ $constructor("$ZodIntersection", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    const left = def.left._zod.run({ value: input, issues: [] }, ctx);
    const right = def.right._zod.run({ value: input, issues: [] }, ctx);
    const async = left instanceof Promise || right instanceof Promise;
    if (async) {
      return Promise.all([left, right]).then(([left2, right2]) => {
        return handleIntersectionResults(payload, left2, right2);
      });
    }
    return handleIntersectionResults(payload, left, right);
  };
});
function mergeValues(a, b) {
  if (a === b) {
    return { valid: true, data: a };
  }
  if (a instanceof Date && b instanceof Date && +a === +b) {
    return { valid: true, data: a };
  }
  if (isPlainObject4(a) && isPlainObject4(b)) {
    const bKeys = Object.keys(b);
    const sharedKeys = Object.keys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    if (Object.prototype.hasOwnProperty.call(newObj, "__proto__"))
      delete newObj.__proto__;
    for (const key of sharedKeys) {
      if (key === "__proto__")
        continue;
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return {
          valid: false,
          mergeErrorPath: [key, ...sharedValue.mergeErrorPath]
        };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return { valid: false, mergeErrorPath: [] };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return {
          valid: false,
          mergeErrorPath: [index, ...sharedValue.mergeErrorPath]
        };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  }
  return { valid: false, mergeErrorPath: [] };
}
function handleIntersectionResults(result, left, right) {
  const unrecKeys = /* @__PURE__ */ new Map();
  let unrecIssue;
  const keyIssues = /* @__PURE__ */ new Map();
  const collect = (iss, side) => {
    let keys;
    if (iss.code === "unrecognized_keys" && !iss.path?.length) {
      unrecIssue ?? (unrecIssue = iss);
      keys = iss.keys;
    } else if (iss.code === "invalid_key" && iss.origin === "record" && iss.path?.length === 1) {
      const k = String(iss.path[0]);
      if (!keyIssues.has(k))
        keyIssues.set(k, iss);
      keys = [k];
    } else {
      return false;
    }
    for (const k of keys) {
      if (!unrecKeys.has(k))
        unrecKeys.set(k, {});
      unrecKeys.get(k)[side] = true;
    }
    return true;
  };
  for (const iss of left.issues) {
    if (!collect(iss, "l"))
      result.issues.push(iss);
  }
  for (const iss of right.issues) {
    if (!collect(iss, "r"))
      result.issues.push(iss);
  }
  const bothKeys = [...unrecKeys].filter(([, f]) => f.l && f.r).map(([k]) => k);
  if (bothKeys.length) {
    const aggregated = unrecIssue ? bothKeys.filter((k) => unrecIssue.keys.includes(k)) : [];
    if (aggregated.length)
      result.issues.push({ ...unrecIssue, keys: aggregated });
    for (const k of bothKeys) {
      if (!aggregated.includes(k) && keyIssues.has(k))
        result.issues.push(keyIssues.get(k));
    }
  }
  const merged = mergeValues(left.value, right.value);
  if (!merged.valid) {
    if (aborted(result))
      return result;
    throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(merged.mergeErrorPath)}`);
  }
  result.value = merged.data;
  return result;
}
var $ZodEnum = /* @__PURE__ */ $constructor("$ZodEnum", (inst, def) => {
  $ZodType.init(inst, def);
  const values = getEnumValues(def.entries);
  const valuesSet = new Set(values);
  inst._zod.values = valuesSet;
  defineLazyInternal(inst, "pattern", (zod) => {
    const patternValues = getEnumValues(zod.def.entries).filter((k) => propertyKeyTypes.has(typeof k));
    return new RegExp(patternValues.length ? `^(${patternValues.map((o) => escapeRegex(o.toString())).join("|")})$` : "^[^\\s\\S]$");
  });
  inst._zod.parse = (payload, _ctx) => {
    const input = payload.value;
    if (valuesSet.has(input)) {
      return payload;
    }
    payload.issues.push({
      code: "invalid_value",
      values,
      input,
      inst
    });
    return payload;
  };
});
var $ZodLiteral = /* @__PURE__ */ $constructor("$ZodLiteral", (inst, def) => {
  $ZodType.init(inst, def);
  const values = new Set(def.values);
  inst._zod.values = values;
  defineLazyInternal(inst, "pattern", (zod) => {
    const vals = zod.def.values;
    return new RegExp(vals.length ? `^(${vals.map((o) => typeof o === "string" ? escapeRegex(o) : o ? escapeRegex(o.toString()) : String(o)).join("|")})$` : "^[^\\s\\S]$");
  });
  inst._zod.parse = (payload, _ctx) => {
    const input = payload.value;
    if (values.has(input)) {
      return payload;
    }
    payload.issues.push({
      code: "invalid_value",
      values: def.values,
      input,
      inst
    });
    return payload;
  };
});
var $ZodTransform = /* @__PURE__ */ $constructor("$ZodTransform", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "optional";
  globalConfig.memoizer?.guard(inst);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      throw new $ZodEncodeError(inst.constructor.name);
    }
    const _out = def.transform(payload.value, payload);
    if (ctx.async) {
      const output = _out instanceof Promise ? _out : Promise.resolve(_out);
      return output.then((output2) => {
        payload.value = output2;
        return payload;
      });
    }
    if (_out instanceof Promise) {
      throw new $ZodAsyncError();
    }
    payload.value = _out;
    return payload;
  };
});
function handleOptionalResult(payload, result) {
  payload.value = result.issues.length ? void 0 : result.value;
  return payload;
}
var $ZodOptional = /* @__PURE__ */ $constructor("$ZodOptional", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin === "defaulted" ? "defaulted" : "optional");
  inst._zod.optout = "optional";
  defineLazyInternal(inst, "values", (zod) => {
    const values = zod.def.innerType._zod.values;
    return values ? /* @__PURE__ */ new Set([...values, void 0]) : void 0;
  });
  defineLazyInternal(inst, "pattern", (zod) => {
    const pattern = zod.def.innerType._zod.pattern;
    return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : void 0;
  });
  inst._zod.parse = (payload, ctx) => {
    if (payload.value === void 0) {
      if (def.innerType._zod.optin !== "defaulted")
        return payload;
      const result = def.innerType._zod.run({ value: payload.value, issues: [] }, ctx);
      if (result instanceof Promise)
        return result.then((result2) => handleOptionalResult(payload, result2));
      return handleOptionalResult(payload, result);
    }
    return def.innerType._zod.run(payload, ctx);
  };
});
var $ZodExactOptional = /* @__PURE__ */ $constructor("$ZodExactOptional", (inst, def) => {
  $ZodOptional.init(inst, def);
  defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
  defineLazyInternal(inst, "pattern", (zod) => zod.def.innerType._zod.pattern);
  inst._zod.parse = (payload, ctx) => {
    return def.innerType._zod.run(payload, ctx);
  };
});
var $ZodNullable = /* @__PURE__ */ $constructor("$ZodNullable", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin);
  defineLazyInternal(inst, "optout", (zod) => zod.def.innerType._zod.optout);
  defineLazyInternal(inst, "pattern", (zod) => {
    const pattern = zod.def.innerType._zod.pattern;
    return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : void 0;
  });
  defineLazyInternal(inst, "values", (zod) => {
    return zod.def.innerType._zod.values ? /* @__PURE__ */ new Set([...zod.def.innerType._zod.values, null]) : void 0;
  });
  inst._zod.parse = (payload, ctx) => {
    if (payload.value === null)
      return payload;
    return def.innerType._zod.run(payload, ctx);
  };
});
var $ZodDefault = /* @__PURE__ */ $constructor("$ZodDefault", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "defaulted";
  defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    if (payload.value === void 0) {
      payload.value = def.defaultValue;
      return payload;
    }
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then((result2) => handleDefaultResult(result2, def));
    }
    return handleDefaultResult(result, def);
  };
});
function handleDefaultResult(payload, def) {
  if (payload.value === void 0) {
    payload.value = def.defaultValue;
  }
  return payload;
}
var $ZodPrefault = /* @__PURE__ */ $constructor("$ZodPrefault", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "defaulted";
  defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    if (payload.value === void 0) {
      payload.value = def.defaultValue;
    }
    return def.innerType._zod.run(payload, ctx);
  };
});
var $ZodNonOptional = /* @__PURE__ */ $constructor("$ZodNonOptional", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazyInternal(inst, "values", (zod) => {
    const v = zod.def.innerType._zod.values;
    return v ? new Set([...v].filter((x) => x !== void 0)) : void 0;
  });
  inst._zod.parse = (payload, ctx) => {
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then((result2) => handleNonOptionalResult(result2, inst));
    }
    return handleNonOptionalResult(result, inst);
  };
});
function handleNonOptionalResult(payload, inst) {
  if (!payload.issues.length && payload.value === void 0) {
    payload.issues.push({
      code: "invalid_type",
      expected: "nonoptional",
      input: payload.value,
      inst
    });
  }
  return payload;
}
function handleCatchResult(payload, result, def, ctx) {
  if (!result.issues.length) {
    payload.value = result.value;
    if (result.memo)
      payload.memo = true;
    return payload;
  }
  payload.value = def.catchValue({
    ...result,
    value: payload.value,
    error: {
      issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config()))
    },
    input: payload.value
  });
  return payload;
}
var $ZodCatch = /* @__PURE__ */ $constructor("$ZodCatch", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin === "defaulted" ? "defaulted" : "optional");
  defineLazyInternal(inst, "optout", (zod) => zod.def.innerType._zod.optout);
  defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    const result = def.innerType._zod.run({ value: payload.value, issues: [] }, ctx);
    if (result instanceof Promise) {
      return result.then((result2) => handleCatchResult(payload, result2, def, ctx));
    }
    return handleCatchResult(payload, result, def, ctx);
  };
});
var $ZodPipe = /* @__PURE__ */ $constructor("$ZodPipe", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazyInternal(inst, "values", (zod) => zod.def.in._zod.values);
  defineLazyInternal(inst, "optin", (zod) => zod.def.in._zod.optin);
  defineLazyInternal(inst, "optout", (zod) => zod.def.out._zod.optout);
  defineLazyInternal(inst, "propValues", (zod) => zod.def.in._zod.propValues);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      const right = def.out._zod.run(payload, ctx);
      if (right instanceof Promise) {
        return right.then((right2) => handlePipeResult(right2, def.in, ctx));
      }
      return handlePipeResult(right, def.in, ctx);
    }
    const left = def.in._zod.run(payload, ctx);
    if (left instanceof Promise) {
      return left.then((left2) => handlePipeResult(left2, def.out, ctx));
    }
    return handlePipeResult(left, def.out, ctx);
  };
});
function handlePipeResult(left, next, ctx) {
  if (left.issues.some((iss) => iss.code !== "unrecognized_keys")) {
    left.aborted = true;
    return left;
  }
  return next._zod.run({ value: left.value, issues: left.issues }, ctx);
}
var $ZodReadonly = /* @__PURE__ */ $constructor("$ZodReadonly", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazyInternal(inst, "propValues", (zod) => zod.def.innerType._zod.propValues);
  defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
  defineLazyInternal(inst, "optin", (zod) => zod.def.innerType?._zod?.optin);
  defineLazyInternal(inst, "optout", (zod) => zod.def.innerType?._zod?.optout);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then(handleReadonlyResult);
    }
    return handleReadonlyResult(result);
  };
});
function handleReadonlyResult(payload) {
  if (!payload.memo)
    payload.value = Object.freeze(payload.value);
  return payload;
}
var $ZodCustom = /* @__PURE__ */ $constructor("$ZodCustom", (inst, def) => {
  $ZodCheck.init(inst, def);
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, _) => {
    return payload;
  };
  inst._zod.check = (payload) => {
    const input = payload.value;
    const r = def.fn(input);
    if (r instanceof Promise) {
      return r.then((r2) => handleRefineResult(r2, payload, input, inst));
    }
    handleRefineResult(r, payload, input, inst);
    return;
  };
});
function handleRefineResult(result, payload, input, inst) {
  if (!result) {
    const _iss = {
      code: "custom",
      input,
      inst,
      // incorporates params.error into issue reporting
      path: [...inst._zod.def.path ?? []],
      // incorporates params.error into issue reporting
      continue: !inst._zod.def.abort
      // params: inst._zod.def.params,
    };
    if (inst._zod.def.params)
      _iss.params = inst._zod.def.params;
    payload.issues.push(issue(_iss));
  }
}

// node_modules/zod/v4/core/memoizer.js
var $ZodCyclicError = class extends Error {
  constructor() {
    super(`Cannot parse a reference cycle that closes through a transform`);
    this.name = "ZodCyclicError";
  }
};
var STATE = "~memo";
var NO_ISSUES = [];
function isRef(value) {
  return value !== null && typeof value === "object";
}
function cloneIssues(issues) {
  return issues.map((iss) => iss.path ? { ...iss, path: iss.path.slice() } : { ...iss });
}
var recursive = /* @__PURE__ */ new WeakMap();
var NONE = 0;
var ASSUMED = 1;
var PROVEN = 2;
function isRecursive(inst, stack, resolve23) {
  const cached2 = recursive.get(inst);
  if (cached2 !== void 0)
    return cached2 ? PROVEN : NONE;
  if (stack.has(inst))
    return PROVEN;
  stack.add(inst);
  let result = NONE;
  const check = (child) => {
    if (result !== PROVEN && child?._zod) {
      const answer = isRecursive(child, stack, resolve23);
      if (answer > result)
        result = answer;
    }
  };
  const shape = (sh, spread) => {
    let answer = NONE;
    for (const key of Reflect.ownKeys(sh)) {
      const desc = Object.getOwnPropertyDescriptor(sh, key);
      if (spread && !desc.enumerable)
        continue;
      const child = desc.get ? ASSUMED : desc.value?._zod ? isRecursive(desc.value, stack, resolve23) : NONE;
      if (child > answer)
        answer = child;
    }
    return answer;
  };
  const merge2 = (answer) => {
    if (answer > result)
      result = answer;
  };
  const def = inst._zod.def;
  const kind = def.type;
  switch (kind) {
    case "object": {
      const raw = rawShape(def);
      merge2(raw ? shape(raw, true) : ASSUMED);
      check(def.catchall);
      break;
    }
    case "array":
      check(def.element);
      break;
    case "tuple":
      for (const el of def.items)
        check(el);
      check(def.rest);
      break;
    case "record":
    case "map":
      check(def.keyType);
      check(def.valueType);
      break;
    case "set":
      check(def.valueType);
      break;
    case "union":
      for (const el of def.options)
        check(el);
      break;
    case "intersection":
      check(def.left);
      check(def.right);
      break;
    case "optional":
    case "nullable":
    case "default":
    case "prefault":
    case "catch":
    case "readonly":
    case "nonoptional":
    case "promise":
    case "success":
      check(def.innerType);
      break;
    case "pipe":
      check(def.in);
      check(def.out);
      break;
    case "function":
      check(def.input);
      check(def.output);
      break;
    // `$ZodLazy` caches its inner on the def, so a resolved edge is followed exactly
    case "lazy": {
      const inner = def._cachedInner ?? (resolve23 ? inst._zod.innerType : void 0);
      merge2(inner ? isRecursive(inner, stack, false) : ASSUMED);
      break;
    }
    // a leaf by choice: `parts` are regex fragments, not data positions
    case "template_literal":
    // leaves
    case "string":
    case "number":
    case "int":
    case "boolean":
    case "bigint":
    case "symbol":
    case "undefined":
    case "null":
    case "void":
    case "never":
    case "any":
    case "unknown":
    case "date":
    case "nan":
    case "enum":
    case "literal":
    case "file":
    case "transform":
    case "custom":
      break;
    default: {
      kind;
      for (const key in def) {
        const desc = Object.getOwnPropertyDescriptor(def, key);
        if (!desc || desc.get)
          continue;
        const value = desc.value;
        if (!value || typeof value !== "object")
          continue;
        if (value._zod)
          check(value);
        else if (Array.isArray(value))
          for (const el of value)
            check(el);
      }
    }
  }
  stack.delete(inst);
  return settle(inst, result);
}
function settle(inst, answer) {
  if (answer !== ASSUMED)
    recursive.set(inst, answer === PROVEN);
  return answer;
}
function bucketFor(state2, inst) {
  let bucket = state2.buckets.get(inst);
  if (!bucket) {
    bucket = /* @__PURE__ */ new WeakMap();
    state2.buckets.set(inst, bucket);
  }
  return bucket;
}
var handoff;
var open = [];
var memo = {
  alloc(_inst, payload, empty) {
    const bucket = handoff;
    if (!bucket)
      return empty;
    handoff = void 0;
    const entry = { value: empty, issues: null };
    bucket.set(payload.value, entry);
    open.push(entry);
    return empty;
  },
  guard(inst) {
    var _a3;
    (_a3 = inst._zod).deferred ?? (_a3.deferred = []);
    inst._zod.deferred.push(() => {
      const base = inst._zod.parse;
      const wrapped = (payload, ctx) => {
        if (ctx.direction !== "backward" && isBackEdge(ctx, payload.value))
          throw new $ZodCyclicError();
        return base(payload, ctx);
      };
      inst._zod.parse = wrapped;
      if (inst._zod.run === base)
        inst._zod.run = wrapped;
    });
  },
  attach(inst) {
    var _a3;
    let isRecursiveInst;
    let rechecked = false;
    let lastCtx;
    let lastBucket;
    (_a3 = inst._zod).deferred ?? (_a3.deferred = []);
    inst._zod.deferred.push(() => {
      const base = inst._zod.parse;
      const wrapped = (payload, ctx) => {
        if (isRecursiveInst === void 0) {
          const walked = isRecursive(inst, /* @__PURE__ */ new Set(), false);
          if (walked === NONE) {
            inst._zod.parse = base;
            if (inst._zod.run === wrapped)
              inst._zod.run = base;
            return base(payload, ctx);
          }
          if (walked === PROVEN || rechecked)
            isRecursiveInst = true;
          else
            rechecked = true;
        }
        const input = payload.value;
        if (!isRef(input))
          return base(payload, ctx);
        let state2 = ctx[STATE];
        if (!state2) {
          state2 = { buckets: /* @__PURE__ */ new WeakMap(), backEdges: void 0 };
          ctx[STATE] = state2;
        }
        let bucket;
        if (lastCtx === ctx) {
          bucket = lastBucket;
        } else {
          bucket = bucketFor(state2, inst);
          lastCtx = ctx;
          lastBucket = bucket;
        }
        const hit = bucket.get(input);
        if (hit) {
          payload.value = hit.value;
          if (hit.issues) {
            if (hit.issues.length)
              payload.issues.push(...cloneIssues(hit.issues));
          } else {
            payload.memo = true;
            state2.backEdges ?? (state2.backEdges = /* @__PURE__ */ new WeakSet());
            state2.backEdges.add(hit.value);
          }
          return payload;
        }
        handoff = bucket;
        const depth = open.length;
        const result = base(payload, ctx);
        handoff = void 0;
        const entry = open.length > depth ? open.pop() : void 0;
        if (result instanceof Promise) {
          return result.then((r) => {
            if (entry)
              entry.issues = r.issues.length ? cloneIssues(r.issues) : NO_ISSUES;
            return r;
          });
        }
        if (entry)
          entry.issues = result.issues.length ? cloneIssues(result.issues) : NO_ISSUES;
        return result;
      };
      inst._zod.parse = wrapped;
      if (inst._zod.run === base)
        inst._zod.run = wrapped;
    });
  }
};
function memoizer() {
  return memo;
}
function isBackEdge(ctx, value) {
  const backEdges = ctx[STATE]?.backEdges;
  return backEdges !== void 0 && isRef(value) && backEdges.has(value);
}

// node_modules/zod/v4/locales/en.js
var error = () => {
  const Sizable = {
    string: { unit: "characters", verb: "to have" },
    file: { unit: "bytes", verb: "to have" },
    array: { unit: "items", verb: "to have" },
    set: { unit: "items", verb: "to have" },
    map: { unit: "entries", verb: "to have" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "input",
    email: "email address",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO datetime",
    date: "ISO date",
    time: "ISO time",
    duration: "ISO duration",
    ipv4: "IPv4 address",
    ipv6: "IPv6 address",
    mac: "MAC address",
    cidrv4: "IPv4 range",
    cidrv6: "IPv6 range",
    base64: "base64-encoded string",
    base64url: "base64url-encoded string",
    json_string: "JSON string",
    e164: "E.164 number",
    currency_code: "currency code",
    credit_card: "credit card number",
    iban: "IBAN",
    jwt: "JWT",
    template_literal: "input"
  };
  const TypeDictionary = {
    // Compatibility: "nan" -> "NaN" for display
    nan: "NaN"
    // All other type names omitted - they fall back to raw values via ?? operator
  };
  function getTypeName(type, input) {
    if (type === "number" && typeof input === "number" && !Number.isFinite(input)) {
      return String(input);
    }
    return TypeDictionary[type] ?? type;
  }
  return (issue2) => {
    switch (issue2.code) {
      case "invalid_type": {
        const expected = getTypeName(issue2.expected);
        const receivedType = parsedType(issue2.input);
        const received = getTypeName(receivedType, issue2.input);
        return `Invalid input: expected ${expected}, received ${received}`;
      }
      case "invalid_value":
        if (issue2.values.length === 1)
          return `Invalid input: expected ${stringifyPrimitive(issue2.values[0])}`;
        return `Invalid option: expected one of ${joinValues(issue2.values, "|")}`;
      case "too_big": {
        const adj = issue2.exact ? "exactly " : issue2.inclusive ? "<=" : "<";
        const sizing = getSizing(issue2.origin);
        if (sizing)
          return `Too big: expected ${issue2.origin ?? "value"} to have ${adj}${issue2.maximum.toString()} ${sizing.unit ?? "elements"}`;
        return `Too big: expected ${issue2.origin ?? "value"} to be ${adj}${issue2.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue2.exact ? "exactly " : issue2.inclusive ? ">=" : ">";
        const sizing = getSizing(issue2.origin);
        if (sizing) {
          return `Too small: expected ${issue2.origin} to have ${adj}${issue2.minimum.toString()} ${sizing.unit}`;
        }
        return `Too small: expected ${issue2.origin} to be ${adj}${issue2.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue2;
        if (_issue.format === "starts_with") {
          return `Invalid string: must start with "${_issue.prefix}"`;
        }
        if (_issue.format === "ends_with")
          return `Invalid string: must end with "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Invalid string: must include "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Invalid string: must match pattern ${_issue.pattern}`;
        return `Invalid ${FormatDictionary[_issue.format] ?? issue2.format}`;
      }
      case "not_multiple_of":
        return `Invalid number: must be a multiple of ${issue2.divisor}`;
      case "unrecognized_keys":
        return `Unrecognized key${issue2.keys.length > 1 ? "s" : ""}: ${joinValues(issue2.keys, ", ")}`;
      case "invalid_key":
        return `Invalid key in ${issue2.origin}`;
      case "invalid_union":
        if (issue2.options && Array.isArray(issue2.options) && issue2.options.length > 0) {
          const opts = issue2.options.map((o) => `'${o}'`).join(" | ");
          return `Invalid discriminator value. Expected ${opts}`;
        }
        if (issue2.inclusive === false) {
          return "Invalid input: more than one option matched";
        }
        return "Invalid input";
      case "invalid_element":
        return `Invalid value in ${issue2.origin}`;
      default:
        return `Invalid input`;
    }
  };
};
function en_default() {
  return {
    localeError: error()
  };
}

// node_modules/zod/v4/core/registries.js
var _a2;
var $ZodRegistry = class {
  constructor() {
    this._map = /* @__PURE__ */ new WeakMap();
    this._idmap = /* @__PURE__ */ new Map();
  }
  add(schema, ..._meta) {
    const meta2 = _meta[0];
    this._map.set(schema, meta2);
    if (meta2 && typeof meta2 === "object" && "id" in meta2) {
      this._idmap.set(meta2.id, schema);
    }
    return this;
  }
  clear() {
    this._map = /* @__PURE__ */ new WeakMap();
    this._idmap = /* @__PURE__ */ new Map();
    return this;
  }
  remove(schema) {
    const meta2 = this._map.get(schema);
    if (meta2 && typeof meta2 === "object" && "id" in meta2) {
      this._idmap.delete(meta2.id);
    }
    this._map.delete(schema);
    return this;
  }
  get(schema) {
    const p = schema._zod.parent;
    if (p) {
      const pm = { ...this.get(p) ?? {} };
      delete pm.id;
      const f = { ...pm, ...this._map.get(schema) };
      return Object.keys(f).length ? f : void 0;
    }
    return this._map.get(schema);
  }
  has(schema) {
    return this._map.has(schema);
  }
};
function registry() {
  return new $ZodRegistry();
}
(_a2 = globalThis).__zod_globalRegistry ?? (_a2.__zod_globalRegistry = registry());
var globalRegistry = globalThis.__zod_globalRegistry;

// node_modules/zod/v4/core/api.js
function snapshotChecks(def) {
  if (def.checks)
    def.checks = [...def.checks];
  return def;
}
// @__NO_SIDE_EFFECTS__
function _string(Class2, params) {
  return new Class2(snapshotChecks({ type: "string", ...normalizeParams(params) }));
}
// @__NO_SIDE_EFFECTS__
function _email(Class2, params) {
  return new Class2({
    type: "string",
    format: "email",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _guid(Class2, params) {
  return new Class2({
    type: "string",
    format: "guid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uuid(Class2, params) {
  return new Class2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uuidv4(Class2, params) {
  return new Class2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v4",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uuidv6(Class2, params) {
  return new Class2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v6",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uuidv7(Class2, params) {
  return new Class2({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v7",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _url(Class2, params) {
  return new Class2({
    type: "string",
    format: "url",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _emoji2(Class2, params) {
  return new Class2({
    type: "string",
    format: "emoji",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _nanoid(Class2, params) {
  return new Class2({
    type: "string",
    format: "nanoid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _cuid(Class2, params) {
  return new Class2({
    type: "string",
    format: "cuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _cuid2(Class2, params) {
  return new Class2({
    type: "string",
    format: "cuid2",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _ulid(Class2, params) {
  return new Class2({
    type: "string",
    format: "ulid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _xid(Class2, params) {
  return new Class2({
    type: "string",
    format: "xid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _ksuid(Class2, params) {
  return new Class2({
    type: "string",
    format: "ksuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _ipv4(Class2, params) {
  return new Class2({
    type: "string",
    format: "ipv4",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _ipv6(Class2, params) {
  return new Class2({
    type: "string",
    format: "ipv6",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _cidrv4(Class2, params) {
  return new Class2({
    type: "string",
    format: "cidrv4",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _cidrv6(Class2, params) {
  return new Class2({
    type: "string",
    format: "cidrv6",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _base64(Class2, params) {
  return new Class2({
    type: "string",
    format: "base64",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _base64url(Class2, params) {
  return new Class2({
    type: "string",
    format: "base64url",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _e164(Class2, params) {
  return new Class2({
    type: "string",
    format: "e164",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _jwt(Class2, params) {
  return new Class2({
    type: "string",
    format: "jwt",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _isoDateTime(Class2, params) {
  return new Class2({
    type: "string",
    format: "datetime",
    check: "string_format",
    offset: false,
    local: false,
    precision: null,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _isoDate(Class2, params) {
  return new Class2({
    type: "string",
    format: "date",
    check: "string_format",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _isoTime(Class2, params) {
  return new Class2({
    type: "string",
    format: "time",
    check: "string_format",
    precision: null,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _isoDuration(Class2, params) {
  return new Class2({
    type: "string",
    format: "duration",
    check: "string_format",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _number(Class2, params) {
  return new Class2(snapshotChecks({ type: "number", checks: [], ...normalizeParams(params) }));
}
// @__NO_SIDE_EFFECTS__
function _int(Class2, params) {
  return new Class2({
    type: "number",
    check: "number_format",
    abort: false,
    format: "safeint",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _boolean(Class2, params) {
  return new Class2({
    type: "boolean",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _unknown(Class2) {
  return new Class2({
    type: "unknown"
  });
}
// @__NO_SIDE_EFFECTS__
function _never(Class2, params) {
  return new Class2({
    type: "never",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _lt(value, params) {
  return new $ZodCheckLessThan({
    check: "less_than",
    ...normalizeParams(params),
    value,
    inclusive: false
  });
}
// @__NO_SIDE_EFFECTS__
function _lte(value, params) {
  return new $ZodCheckLessThan({
    check: "less_than",
    ...normalizeParams(params),
    value,
    inclusive: true
  });
}
// @__NO_SIDE_EFFECTS__
function _gt(value, params) {
  return new $ZodCheckGreaterThan({
    check: "greater_than",
    ...normalizeParams(params),
    value,
    inclusive: false
  });
}
// @__NO_SIDE_EFFECTS__
function _gte(value, params) {
  return new $ZodCheckGreaterThan({
    check: "greater_than",
    ...normalizeParams(params),
    value,
    inclusive: true
  });
}
// @__NO_SIDE_EFFECTS__
function _multipleOf(value, params) {
  return new $ZodCheckMultipleOf({
    check: "multiple_of",
    ...normalizeParams(params),
    value
  });
}
// @__NO_SIDE_EFFECTS__
function _maxLength(maximum, params) {
  const ch = new $ZodCheckMaxLength({
    check: "max_length",
    ...normalizeParams(params),
    maximum
  });
  return ch;
}
// @__NO_SIDE_EFFECTS__
function _minLength(minimum, params) {
  return new $ZodCheckMinLength({
    check: "min_length",
    ...normalizeParams(params),
    minimum
  });
}
// @__NO_SIDE_EFFECTS__
function _length(length, params) {
  return new $ZodCheckLengthEquals({
    check: "length_equals",
    ...normalizeParams(params),
    length
  });
}
// @__NO_SIDE_EFFECTS__
function _regex(pattern, params) {
  return new $ZodCheckRegex({
    check: "string_format",
    format: "regex",
    ...normalizeParams(params),
    pattern
  });
}
// @__NO_SIDE_EFFECTS__
function _lowercase(params) {
  return new $ZodCheckLowerCase({
    check: "string_format",
    format: "lowercase",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uppercase(params) {
  return new $ZodCheckUpperCase({
    check: "string_format",
    format: "uppercase",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _includes(includes, params) {
  return new $ZodCheckIncludes({
    check: "string_format",
    format: "includes",
    ...normalizeParams(params),
    includes
  });
}
// @__NO_SIDE_EFFECTS__
function _startsWith(prefix, params) {
  return new $ZodCheckStartsWith({
    check: "string_format",
    format: "starts_with",
    ...normalizeParams(params),
    prefix
  });
}
// @__NO_SIDE_EFFECTS__
function _endsWith(suffix, params) {
  return new $ZodCheckEndsWith({
    check: "string_format",
    format: "ends_with",
    ...normalizeParams(params),
    suffix
  });
}
// @__NO_SIDE_EFFECTS__
function _overwrite(tx) {
  return new $ZodCheckOverwrite({
    check: "overwrite",
    tx
  });
}
// @__NO_SIDE_EFFECTS__
function _normalize(form) {
  return /* @__PURE__ */ _overwrite((input) => input.normalize(form));
}
// @__NO_SIDE_EFFECTS__
function _trim() {
  return /* @__PURE__ */ _overwrite((input) => input.trim());
}
// @__NO_SIDE_EFFECTS__
function _toLowerCase() {
  return /* @__PURE__ */ _overwrite((input) => input.toLowerCase());
}
// @__NO_SIDE_EFFECTS__
function _toUpperCase() {
  return /* @__PURE__ */ _overwrite((input) => input.toUpperCase());
}
// @__NO_SIDE_EFFECTS__
function _slugify() {
  return /* @__PURE__ */ _overwrite((input) => slugify(input));
}
// @__NO_SIDE_EFFECTS__
function _array(Class2, element, params) {
  return new Class2({
    type: "array",
    element,
    // get element() {
    //   return element;
    // },
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _refine(Class2, fn, _params) {
  const schema = new Class2({
    type: "custom",
    check: "custom",
    fn,
    ...normalizeParams(_params)
  });
  return schema;
}
// @__NO_SIDE_EFFECTS__
function _superRefine(fn, params) {
  const ch = /* @__PURE__ */ _check((payload) => {
    payload.addIssue = (issue2) => {
      if (typeof issue2 === "string") {
        payload.issues.push(issue(issue2, payload.value, ch._zod.def));
      } else {
        const _issue = issue2;
        if (_issue.fatal)
          _issue.continue = false;
        _issue.code ?? (_issue.code = "custom");
        if (!("input" in _issue))
          _issue.input = payload.value;
        _issue.inst ?? (_issue.inst = ch);
        _issue.continue ?? (_issue.continue = !ch._zod.def.abort);
        payload.issues.push(issue(_issue));
      }
    };
    return fn(payload.value, payload);
  }, params);
  return ch;
}
// @__NO_SIDE_EFFECTS__
function _check(fn, params) {
  const ch = new $ZodCheck({
    check: "custom",
    ...normalizeParams(params)
  });
  ch._zod.check = fn;
  return ch;
}

// node_modules/zod/v4/core/to-json-schema.js
function assignProps(target, ...sources) {
  for (const source of sources) {
    for (const key of Reflect.ownKeys(source)) {
      if (Object.prototype.propertyIsEnumerable.call(source, key)) {
        assignProp(target, key, source[key]);
      }
    }
  }
  return target;
}
function initializeContext(params) {
  let target = params?.target ?? "draft-2020-12";
  if (target === "draft-4")
    target = "draft-04";
  if (target === "draft-7")
    target = "draft-07";
  return {
    processors: params.processors ?? {},
    metadataRegistry: params?.metadata ?? globalRegistry,
    target,
    unrepresentable: params?.unrepresentable ?? "throw",
    override: params?.override ?? (() => {
    }),
    io: params?.io ?? "output",
    counter: 0,
    seen: /* @__PURE__ */ new Map(),
    sharedDefsExtractedFor: void 0,
    sharedEmitDoneFor: void 0,
    cycles: params?.cycles ?? "ref",
    reused: params?.reused ?? "inline",
    intersections: [],
    deferred: [],
    external: params?.external ?? void 0
  };
}
function handleUnrepresentable(schema, ctx, json, params, message) {
  const result = typeof ctx.unrepresentable === "function" ? ctx.unrepresentable({ zodSchema: schema, path: params.path, message }) : ctx.unrepresentable;
  if (result === "any")
    return false;
  if (result === void 0 || result === "throw")
    throw new Error(message);
  Object.assign(json, result);
  return true;
}
function processSchema(schema, ctx, _params = { path: [], schemaPath: [] }) {
  var _a3;
  const def = schema._zod.def;
  const seen = ctx.seen.get(schema);
  if (seen) {
    seen.count++;
    const isCycle = _params.schemaPath.includes(schema);
    if (isCycle) {
      seen.cycle = _params.path;
    }
    return seen.schema;
  }
  const result = { schema: {}, count: 1, cycle: void 0, path: _params.path };
  ctx.seen.set(schema, result);
  ctx.sharedDefsExtractedFor = void 0;
  ctx.sharedEmitDoneFor = void 0;
  const overrideSchema = schema._zod.toJSONSchema?.();
  if (overrideSchema) {
    result.schema = overrideSchema;
  } else {
    const params = {
      ..._params,
      schemaPath: [..._params.schemaPath, schema],
      path: _params.path
    };
    if (schema._zod.processJSONSchema) {
      schema._zod.processJSONSchema(ctx, result.schema, params);
    } else {
      const _json = result.schema;
      const processor = ctx.processors[def.type];
      if (!processor) {
        throw new Error(`[toJSONSchema]: Non-representable type encountered: ${def.type}`);
      }
      processor(schema, ctx, _json, params);
    }
    const parent = schema._zod.parent;
    if (parent) {
      if (!result.ref)
        result.ref = parent;
      processSchema(parent, ctx, params);
      ctx.seen.get(parent).isParent = true;
    }
  }
  const meta2 = ctx.metadataRegistry.get(schema);
  if (meta2)
    assignProps(result.schema, meta2);
  if (ctx.io === "input" && isTransforming(schema)) {
    delete result.schema.examples;
    delete result.schema.default;
  }
  if (ctx.io === "input" && "_prefault" in result.schema)
    (_a3 = result.schema).default ?? (_a3.default = result.schema._prefault);
  delete result.schema._prefault;
  const _result = ctx.seen.get(schema);
  return _result.schema;
}
function encodeJSONPointerSegment(segment) {
  return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}
function extractDefs(ctx, schema) {
  const root = ctx.seen.get(schema);
  if (!root)
    throw new Error("Unprocessed schema. This is a bug in Zod.");
  if (ctx.external && ctx.sharedDefsExtractedFor === ctx.external)
    return;
  const idToSchema = /* @__PURE__ */ new Map();
  for (const entry of ctx.seen.entries()) {
    const id = ctx.metadataRegistry.get(entry[0])?.id;
    if (id) {
      const existing = idToSchema.get(id);
      if (existing && existing !== entry[0]) {
        throw new Error(`Duplicate schema id "${id}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
      }
      idToSchema.set(id, entry[0]);
    }
  }
  const makeURI = (entry) => {
    const defsSegment = ctx.target === "draft-2020-12" ? "$defs" : "definitions";
    if (ctx.external) {
      const externalId = ctx.external.registry.get(entry[0])?.id;
      const uriGenerator = ctx.external.uri ?? ((id2) => id2);
      if (externalId) {
        return { ref: uriGenerator(externalId) };
      }
      const id = entry[1].defId ?? entry[1].schema.id ?? `schema${ctx.counter++}`;
      entry[1].defId = id;
      return { defId: id, ref: `${uriGenerator("__shared")}#/${defsSegment}/${encodeJSONPointerSegment(id)}` };
    }
    const uriPrefix = `#`;
    const defUriPrefix = `${uriPrefix}/${defsSegment}/`;
    if (entry[1] === root && !entry[1].schema.id) {
      return { ref: uriPrefix };
    }
    const defId = entry[1].schema.id ?? `__schema${ctx.counter++}`;
    return { defId, ref: defUriPrefix + encodeJSONPointerSegment(defId) };
  };
  const extractToDef = (entry) => {
    if (entry[1].schema.$ref) {
      return;
    }
    const seen = entry[1];
    const { ref, defId } = makeURI(entry);
    seen.def = { ...seen.schema };
    if (defId)
      seen.defId = defId;
    const schema2 = seen.schema;
    for (const key in schema2) {
      delete schema2[key];
    }
    schema2.$ref = ref;
  };
  if (ctx.cycles === "throw") {
    for (const entry of ctx.seen.entries()) {
      const seen = entry[1];
      if (seen.cycle) {
        throw new Error(`Cycle detected: #/${seen.cycle?.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
      }
    }
  }
  for (const entry of ctx.seen.entries()) {
    const seen = entry[1];
    if (schema === entry[0]) {
      extractToDef(entry);
      continue;
    }
    if (ctx.external) {
      const ext = ctx.external.registry.get(entry[0])?.id;
      if (schema !== entry[0] && ext) {
        extractToDef(entry);
        continue;
      }
    }
    const id = ctx.metadataRegistry.get(entry[0])?.id;
    if (id) {
      extractToDef(entry);
      continue;
    }
    if (seen.cycle) {
      extractToDef(entry);
      continue;
    }
    if (seen.count > 1) {
      if (ctx.reused === "ref") {
        extractToDef(entry);
      }
    }
  }
  if (ctx.external)
    ctx.sharedDefsExtractedFor = ctx.external;
}
function compactTypeUnion(schema) {
  const options = schema.anyOf;
  if (!Array.isArray(options) || options.length === 0 || schema.type !== void 0)
    return;
  const types = [];
  for (const option of options) {
    if (!option || typeof option !== "object")
      return;
    compactTypeUnion(option);
    const keys = Object.keys(option);
    if (keys.length !== 1 || keys[0] !== "type")
      return;
    const type = option.type;
    for (const member of Array.isArray(type) ? type : [type]) {
      if (typeof member !== "string")
        return;
      if (!types.includes(member))
        types.push(member);
    }
  }
  delete schema.anyOf;
  schema.type = types.length === 1 ? types[0] : types;
}
var FOLDABLE_KEYS = /* @__PURE__ */ new Set(["type", "properties", "required", "additionalProperties"]);
var UNION_KEYS = ["oneOf", "anyOf"];
function undeclaredConstraint(member) {
  const extra = member.additionalProperties;
  if (extra === void 0 || extra === false || typeof extra !== "object" || extra === null)
    return null;
  return Object.keys(extra).length ? extra : null;
}
function foldObjects(members2) {
  const objects = [];
  for (const member of members2) {
    if (typeof member !== "object" || member.type !== "object")
      return null;
    for (const key in member) {
      if (!FOLDABLE_KEYS.has(key))
        return null;
    }
    objects.push(member);
  }
  const properties = {};
  const required2 = /* @__PURE__ */ new Set();
  for (const object2 of objects) {
    for (const key in object2.properties) {
      if (Object.prototype.hasOwnProperty.call(properties, key))
        continue;
      const parts = [];
      for (const other of objects) {
        const part = other.properties?.[key] ?? undeclaredConstraint(other);
        if (part === null || part === void 0)
          continue;
        if (!parts.some((seen) => JSON.stringify(seen) === JSON.stringify(part)))
          parts.push(part);
      }
      const merged = parts.length === 1 ? parts[0] : foldObjects(parts) ?? { allOf: parts };
      assignProp(properties, key, merged);
    }
    for (const key of object2.required ?? [])
      required2.add(key);
  }
  const folded = { type: "object", properties };
  if (required2.size)
    folded.required = [...required2];
  if (objects.every((object2) => object2.additionalProperties === false)) {
    folded.additionalProperties = false;
  } else {
    const constraints = [];
    for (const object2 of objects) {
      const constraint = undeclaredConstraint(object2);
      if (constraint && !constraints.some((seen) => JSON.stringify(seen) === JSON.stringify(constraint)))
        constraints.push(constraint);
    }
    if (constraints.length === 1)
      folded.additionalProperties = constraints[0];
    else if (constraints.length > 1)
      folded.additionalProperties = { allOf: constraints };
  }
  return folded;
}
function foldIntersection(json) {
  const allOf = json.allOf;
  if (!Array.isArray(allOf) || allOf.length < 2)
    return;
  for (const key of FOLDABLE_KEYS)
    if (key in json)
      return;
  const unions = allOf.filter((m) => UNION_KEYS.some((k) => Array.isArray(m[k])));
  let folded = null;
  if (!unions.length) {
    folded = foldObjects(allOf);
  } else {
    const union2 = unions[0];
    const keyword = UNION_KEYS.find((k) => Array.isArray(union2[k]));
    if (Object.keys(union2).length !== 1)
      return;
    const rest = allOf.filter((m) => m !== union2);
    const branches = union2[keyword].map((branch) => foldObjects([...rest, branch]));
    if (branches.some((b) => !b))
      return;
    folded = { [keyword]: branches };
  }
  if (!folded)
    return;
  delete json.allOf;
  assignProps(json, folded);
}
function finalize(ctx, schema) {
  const root = ctx.seen.get(schema);
  if (!root)
    throw new Error("Unprocessed schema. This is a bug in Zod.");
  const flattenRef = (zodSchema) => {
    const seen = ctx.seen.get(zodSchema);
    if (seen.ref === null)
      return;
    const schema2 = seen.def ?? seen.schema;
    const _cached = { ...schema2 };
    const ref = seen.ref;
    seen.ref = null;
    if (ref) {
      flattenRef(ref);
      const refSeen = ctx.seen.get(ref);
      const refSchema = refSeen.schema;
      if (refSchema.$ref && (ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0")) {
        schema2.allOf = schema2.allOf ?? [];
        schema2.allOf.push(refSchema);
      } else {
        assignProps(schema2, refSchema);
      }
      assignProps(schema2, _cached);
      const isParentRef = zodSchema._zod.parent === ref;
      if (isParentRef) {
        for (const key in schema2) {
          if (key === "$ref" || key === "allOf")
            continue;
          if (!(key in _cached)) {
            delete schema2[key];
          }
        }
      }
      if (refSchema.$ref && refSeen.def) {
        for (const key in schema2) {
          if (key === "$ref" || key === "allOf")
            continue;
          if (key in refSeen.def && JSON.stringify(schema2[key]) === JSON.stringify(refSeen.def[key])) {
            delete schema2[key];
          }
        }
      }
    }
    const parent = zodSchema._zod.parent;
    if (parent && parent !== ref) {
      flattenRef(parent);
      const parentSeen = ctx.seen.get(parent);
      if (parentSeen?.schema.$ref) {
        schema2.$ref = parentSeen.schema.$ref;
        if (parentSeen.def) {
          for (const key in schema2) {
            if (key === "$ref" || key === "allOf")
              continue;
            if (key in parentSeen.def && JSON.stringify(schema2[key]) === JSON.stringify(parentSeen.def[key])) {
              delete schema2[key];
            }
          }
        }
      }
    }
    ctx.override({
      zodSchema,
      jsonSchema: schema2,
      path: seen.path ?? []
    });
  };
  if (!ctx.external || ctx.sharedEmitDoneFor !== ctx.external) {
    for (const entry of [...ctx.seen.entries()].reverse()) {
      flattenRef(entry[0]);
    }
    if (ctx.target !== "openapi-3.0") {
      for (const entry of ctx.seen.entries()) {
        compactTypeUnion(entry[1].def ?? entry[1].schema);
      }
    }
    for (const rewrite of ctx.deferred)
      rewrite();
    if (ctx.intersections.length) {
      const carriers = /* @__PURE__ */ new Map();
      for (const seen of ctx.seen.values()) {
        for (const json of [seen.schema, seen.def]) {
          const allOf = json?.allOf;
          if (!Array.isArray(allOf))
            continue;
          const existing = carriers.get(allOf);
          if (existing)
            existing.push(json);
          else
            carriers.set(allOf, [json]);
        }
      }
      for (const allOf of ctx.intersections) {
        for (const json of carriers.get(allOf) ?? [])
          foldIntersection(json);
      }
    }
  }
  const result = {};
  if (ctx.target === "draft-2020-12") {
    result.$schema = "https://json-schema.org/draft/2020-12/schema";
  } else if (ctx.target === "draft-07") {
    result.$schema = "http://json-schema.org/draft-07/schema#";
  } else if (ctx.target === "draft-04") {
    result.$schema = "http://json-schema.org/draft-04/schema#";
  } else if (ctx.target === "openapi-3.0") {
  } else {
  }
  if (ctx.external?.uri) {
    const id = ctx.external.registry.get(schema)?.id;
    if (!id)
      throw new Error("Schema is missing an `id` property");
    result.$id = ctx.external.uri(id);
  }
  assignProps(result, root.defId ? root.schema : root.def ?? root.schema);
  const rootMetaId = ctx.metadataRegistry.get(schema)?.id;
  if (rootMetaId !== void 0 && result.id === rootMetaId)
    delete result.id;
  const defs = ctx.external?.defs ?? {};
  if (!ctx.external || ctx.sharedEmitDoneFor !== ctx.external) {
    for (const entry of ctx.seen.entries()) {
      const seen = entry[1];
      if (seen.def && seen.defId) {
        if (seen.def.id === seen.defId)
          delete seen.def.id;
        assignProp(defs, seen.defId, seen.def);
      }
    }
  }
  if (ctx.external)
    ctx.sharedEmitDoneFor = ctx.external;
  if (ctx.external) {
  } else {
    if (Object.keys(defs).length > 0) {
      if (ctx.target === "draft-2020-12") {
        result.$defs = defs;
      } else {
        result.definitions = defs;
      }
    }
  }
  try {
    const finalized = JSON.parse(JSON.stringify(result));
    Object.defineProperty(finalized, "~standard", {
      value: {
        ...schema["~standard"],
        jsonSchema: {
          input: createStandardJSONSchemaMethod(schema, "input", ctx.processors),
          output: createStandardJSONSchemaMethod(schema, "output", ctx.processors)
        }
      },
      enumerable: false,
      writable: false
    });
    return finalized;
  } catch (_err) {
    throw new Error("Error converting schema to JSON.");
  }
}
function isTransforming(_schema, _ctx) {
  const ctx = _ctx ?? { seen: /* @__PURE__ */ new Set() };
  if (ctx.seen.has(_schema))
    return false;
  ctx.seen.add(_schema);
  const def = _schema._zod.def;
  if (def.type === "transform")
    return true;
  if (def.type === "array")
    return isTransforming(def.element, ctx);
  if (def.type === "set")
    return isTransforming(def.valueType, ctx);
  if (def.type === "lazy")
    return isTransforming(def.getter(), ctx);
  if (def.type === "promise" || def.type === "optional" || def.type === "nonoptional" || def.type === "nullable" || def.type === "readonly" || def.type === "default" || def.type === "prefault" || def.type === "catch") {
    return isTransforming(def.innerType, ctx);
  }
  if (def.type === "intersection") {
    return isTransforming(def.left, ctx) || isTransforming(def.right, ctx);
  }
  if (def.type === "record" || def.type === "map") {
    return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
  }
  if (def.type === "pipe") {
    if (_schema._zod.traits.has("$ZodCodec"))
      return true;
    return isTransforming(def.in, ctx) || isTransforming(def.out, ctx);
  }
  if (def.type === "object") {
    for (const key in def.shape) {
      if (isTransforming(def.shape[key], ctx))
        return true;
    }
    return false;
  }
  if (def.type === "union") {
    for (const option of def.options) {
      if (isTransforming(option, ctx))
        return true;
    }
    return false;
  }
  if (def.type === "tuple") {
    for (const item of def.items) {
      if (isTransforming(item, ctx))
        return true;
    }
    if (def.rest && isTransforming(def.rest, ctx))
      return true;
    return false;
  }
  return false;
}
var createToJSONSchemaMethod = (schema, processors = {}) => (params) => {
  const ctx = initializeContext({ ...params, processors });
  processSchema(schema, ctx);
  extractDefs(ctx, schema);
  return finalize(ctx, schema);
};
var createStandardJSONSchemaMethod = (schema, io, processors = {}) => (params) => {
  const { libraryOptions, target } = params ?? {};
  const ctx = initializeContext({ ...libraryOptions ?? {}, target, io, processors });
  processSchema(schema, ctx);
  extractDefs(ctx, schema);
  return finalize(ctx, schema);
};

// node_modules/zod/v4/core/json-schema-processors.js
var narrowMin = (agg, key, value) => {
  if (agg[key] === void 0 || value > agg[key])
    agg[key] = value;
};
var narrowMax = (agg, key, value) => {
  if (agg[key] === void 0 || value < agg[key])
    agg[key] = value;
};
var narrowBoth = (agg, value) => {
  narrowMin(agg, "minimum", value);
  narrowMax(agg, "maximum", value);
};
var addDivisor = (agg, value) => {
  agg.multipleOf ?? (agg.multipleOf = []);
  if (!agg.multipleOf.includes(value))
    agg.multipleOf.push(value);
};
var addPattern = (agg, pattern) => {
  agg.patterns ?? (agg.patterns = /* @__PURE__ */ new Set());
  agg.patterns.add(pattern);
};
var intersectMime = (agg, mime) => {
  agg.mime = agg.mime ? agg.mime.filter((m) => mime.includes(m)) : [...mime];
};
var setFormat = (agg, format) => {
  agg.format = format;
  if (format.includes("int"))
    agg.isInt = true;
};
var minContributor = (agg, def) => narrowMin(agg, "minimum", def.minimum);
var maxContributor = (agg, def) => narrowMax(agg, "maximum", def.maximum);
var formatContributor = (ranges) => (agg, def) => {
  setFormat(agg, def.format);
  const [minimum, maximum] = ranges[def.format];
  narrowMin(agg, "minimum", minimum);
  narrowMax(agg, "maximum", maximum);
};
var contributors = {
  greater_than: (agg, def) => narrowMin(agg, def.inclusive ? "minimum" : "exclusiveMinimum", def.value),
  less_than: (agg, def) => narrowMax(agg, def.inclusive ? "maximum" : "exclusiveMaximum", def.value),
  multiple_of: (agg, def) => addDivisor(agg, def.value),
  number_format: formatContributor(NUMBER_FORMAT_RANGES),
  bigint_format: formatContributor(BIGINT_FORMAT_RANGES),
  min_length: minContributor,
  max_length: maxContributor,
  length_equals: (agg, def) => narrowBoth(agg, def.length),
  min_size: minContributor,
  max_size: maxContributor,
  size_equals: (agg, def) => narrowBoth(agg, def.size),
  string_format: (agg, def) => {
    setFormat(agg, def.format);
    if (def.pattern)
      addPattern(agg, def.pattern);
    if (def.format === "base64" || def.format === "base64url")
      agg.contentEncoding = def.format;
    if (def.local || def.precision === -1)
      agg.laxFormat = true;
  },
  mime_type: (agg, def) => intersectMime(agg, def.mime)
};
function aggregateChecks(schema) {
  const agg = {};
  const def = schema._zod.def;
  const list = schema._zod.traits.has("$ZodCheck") ? [schema, ...def.checks ?? []] : def.checks ?? [];
  for (const ch of list)
    contributors[ch._zod.def.check]?.(agg, ch._zod.def);
  const bag = schema._zod.bag;
  if (bag.minimum !== void 0)
    narrowMin(agg, "minimum", bag.minimum);
  if (bag.exclusiveMinimum !== void 0)
    narrowMin(agg, "exclusiveMinimum", bag.exclusiveMinimum);
  if (bag.maximum !== void 0)
    narrowMax(agg, "maximum", bag.maximum);
  if (bag.exclusiveMaximum !== void 0)
    narrowMax(agg, "exclusiveMaximum", bag.exclusiveMaximum);
  if (bag.multipleOf !== void 0)
    addDivisor(agg, bag.multipleOf);
  if (bag.format !== void 0) {
    agg.format ?? (agg.format = bag.format);
    if (bag.format.includes("int"))
      agg.isInt = true;
  }
  if (bag.mime)
    intersectMime(agg, bag.mime);
  for (const pattern of bag.patterns ?? [])
    addPattern(agg, pattern);
  return agg;
}
var formatMap = {
  guid: "uuid",
  url: "uri",
  datetime: "date-time",
  json_string: "json-string",
  regex: ""
  // do not set
};
var exactPatterns = /* @__PURE__ */ new Map([
  [base64Charset, base64],
  [base64urlCharset, base64url]
]);
var exactPattern = (p) => exactPatterns.get(p) ?? p;
var stringProcessor = (schema, ctx, _json, _params) => {
  const json = _json;
  json.type = "string";
  const { minimum, maximum, format, patterns, contentEncoding, laxFormat } = aggregateChecks(schema);
  if (typeof minimum === "number")
    json.minLength = minimum;
  if (typeof maximum === "number")
    json.maxLength = maximum;
  if (format) {
    json.format = formatMap[format] ?? format;
    if (json.format === "")
      delete json.format;
    if (format === "time" || laxFormat) {
      delete json.format;
    }
  }
  if (contentEncoding)
    json.contentEncoding = contentEncoding;
  if (patterns && patterns.size > 0) {
    const patternList = [...patterns].map(exactPattern);
    if (patternList.length === 1)
      json.pattern = patternList[0].source;
    else if (patternList.length > 1) {
      json.allOf = [
        ...patternList.map((regex) => ({
          ...ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0" ? { type: "string" } : {},
          pattern: regex.source
        }))
      ];
    }
  }
};
var numberProcessor = (schema, ctx, _json, params) => {
  const json = _json;
  const { minimum, maximum, multipleOf, exclusiveMaximum, exclusiveMinimum, isInt } = aggregateChecks(schema);
  json.type = isInt ? "integer" : "number";
  const exMin = typeof exclusiveMinimum === "number" && exclusiveMinimum >= (minimum ?? Number.NEGATIVE_INFINITY);
  const exMax = typeof exclusiveMaximum === "number" && exclusiveMaximum <= (maximum ?? Number.POSITIVE_INFINITY);
  const legacy = ctx.target === "draft-04" || ctx.target === "openapi-3.0";
  if (exMin) {
    if (legacy) {
      json.minimum = exclusiveMinimum;
      json.exclusiveMinimum = true;
    } else {
      json.exclusiveMinimum = exclusiveMinimum;
    }
  } else if (typeof minimum === "number") {
    json.minimum = minimum;
  }
  if (exMax) {
    if (legacy) {
      json.maximum = exclusiveMaximum;
      json.exclusiveMaximum = true;
    } else {
      json.exclusiveMaximum = exclusiveMaximum;
    }
  } else if (typeof maximum === "number") {
    json.maximum = maximum;
  }
  if (multipleOf) {
    const divisors = /* @__PURE__ */ new Set();
    for (const divisor of multipleOf) {
      if (Number.isFinite(divisor) && divisor !== 0)
        divisors.add(Math.abs(divisor));
      else
        handleUnrepresentable(schema, ctx, json, params, `A multipleOf divisor of ${divisor} cannot be represented in JSON Schema`);
    }
    const [first, ...rest] = divisors;
    if (first !== void 0)
      json.multipleOf = first;
    if (rest.length)
      json.allOf = [...json.allOf ?? [], ...rest.map((m) => ({ multipleOf: m }))];
  }
};
var booleanProcessor = (_schema, _ctx, json, _params) => {
  json.type = "boolean";
};
var bigintProcessor = (schema, ctx, json, params) => {
  handleUnrepresentable(schema, ctx, json, params, "BigInt cannot be represented in JSON Schema");
};
var symbolProcessor = (schema, ctx, json, params) => {
  handleUnrepresentable(schema, ctx, json, params, "Symbols cannot be represented in JSON Schema");
};
var nullProcessor = (_schema, ctx, json, _params) => {
  if (ctx.target === "openapi-3.0") {
    json.type = "string";
    json.nullable = true;
    json.enum = [null];
  } else {
    json.type = "null";
  }
};
var undefinedProcessor = (schema, ctx, json, params) => {
  handleUnrepresentable(schema, ctx, json, params, "Undefined cannot be represented in JSON Schema");
};
var voidProcessor = (schema, ctx, json, params) => {
  handleUnrepresentable(schema, ctx, json, params, "Void cannot be represented in JSON Schema");
};
var neverProcessor = (_schema, _ctx, json, _params) => {
  json.not = {};
};
var anyProcessor = (_schema, _ctx, _json, _params) => {
};
var unknownProcessor = (_schema, _ctx, _json, _params) => {
};
var dateProcessor = (schema, ctx, json, params) => {
  handleUnrepresentable(schema, ctx, json, params, "Date cannot be represented in JSON Schema");
};
var enumProcessor = (schema, _ctx, json, _params) => {
  const def = schema._zod.def;
  const values = getEnumValues(def.entries);
  if (values.length === 0) {
    json.not = {};
    return;
  }
  if (values.every((v) => typeof v === "number"))
    json.type = "number";
  if (values.every((v) => typeof v === "string"))
    json.type = "string";
  json.enum = values;
};
var literalProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  if (def.values.length === 0) {
    json.not = {};
    return;
  }
  const vals = [];
  for (const val of def.values) {
    if (val === void 0) {
      if (handleUnrepresentable(schema, ctx, json, params, "Literal `undefined` cannot be represented in JSON Schema"))
        return;
    } else if (typeof val === "bigint") {
      if (handleUnrepresentable(schema, ctx, json, params, "BigInt literals cannot be represented in JSON Schema"))
        return;
      vals.push(Number(val));
    } else {
      vals.push(val);
    }
  }
  if (vals.length === 0) {
  } else if (vals.length === 1) {
    const val = vals[0];
    json.type = val === null ? "null" : typeof val;
    if (ctx.target === "draft-04" || ctx.target === "openapi-3.0") {
      json.enum = [val];
    } else {
      json.const = val;
    }
  } else {
    if (vals.every((v) => typeof v === "number"))
      json.type = "number";
    if (vals.every((v) => typeof v === "string"))
      json.type = "string";
    if (vals.every((v) => typeof v === "boolean"))
      json.type = "boolean";
    if (vals.every((v) => v === null))
      json.type = "null";
    json.enum = vals;
  }
};
var nanProcessor = (schema, ctx, json, params) => {
  handleUnrepresentable(schema, ctx, json, params, "NaN cannot be represented in JSON Schema");
};
var templateLiteralProcessor = (schema, _ctx, json, _params) => {
  const _json = json;
  const pattern = schema._zod.pattern;
  if (!pattern)
    throw new Error("Pattern not found in template literal");
  _json.type = "string";
  _json.pattern = pattern.source;
};
var fileProcessor = (schema, _ctx, json, _params) => {
  const _json = json;
  _json.type = "string";
  _json.format = "binary";
  _json.contentEncoding = "binary";
  const { minimum, maximum, mime } = aggregateChecks(schema);
  if (minimum !== void 0)
    _json.minLength = minimum;
  if (maximum !== void 0)
    _json.maxLength = maximum;
  if (!mime)
    return;
  if (mime.length === 0)
    _json.not = {};
  else if (mime.length === 1)
    _json.contentMediaType = mime[0];
  else
    _json.anyOf = mime.map((m) => ({ contentMediaType: m }));
};
var successProcessor = (_schema, _ctx, json, _params) => {
  json.type = "boolean";
};
var customProcessor = (schema, ctx, json, params) => {
  handleUnrepresentable(schema, ctx, json, params, "Custom types cannot be represented in JSON Schema");
};
var functionProcessor = (schema, ctx, json, params) => {
  handleUnrepresentable(schema, ctx, json, params, "Function types cannot be represented in JSON Schema");
};
var transformProcessor = (schema, ctx, json, params) => {
  handleUnrepresentable(schema, ctx, json, params, "Transforms cannot be represented in JSON Schema");
};
var mapProcessor = (schema, ctx, json, params) => {
  handleUnrepresentable(schema, ctx, json, params, "Map cannot be represented in JSON Schema");
};
var setProcessor = (schema, ctx, json, params) => {
  handleUnrepresentable(schema, ctx, json, params, "Set cannot be represented in JSON Schema");
};
var arrayProcessor = (schema, ctx, _json, params) => {
  const json = _json;
  const def = schema._zod.def;
  const { minimum, maximum } = aggregateChecks(schema);
  if (typeof minimum === "number")
    json.minItems = minimum;
  if (typeof maximum === "number")
    json.maxItems = maximum;
  json.type = "array";
  json.items = processSchema(def.element, ctx, {
    ...params,
    path: [...params.path, "items"]
  });
};
function inputOptin(schema) {
  const def = schema._zod.def;
  if (def.type === "pipe" && def.in._zod.traits.has("$ZodTransform")) {
    return inputOptin(def.out);
  }
  if (def.type === "catch") {
    return inputOptin(def.innerType);
  }
  return schema._zod.optin;
}
var objectProcessor = (schema, ctx, _json, params) => {
  const json = _json;
  const def = schema._zod.def;
  const shape = def.shape;
  const symbolKeys = Object.getOwnPropertySymbols(shape);
  if (symbolKeys.length && handleUnrepresentable(schema, ctx, json, params, "Symbol keys cannot be represented in JSON Schema")) {
    return;
  }
  json.type = "object";
  json.properties = {};
  for (const key in shape) {
    assignProp(json.properties, key, processSchema(shape[key], ctx, {
      ...params,
      path: [...params.path, "properties", key]
    }));
  }
  const requiredKeys = [];
  for (const key of Object.keys(shape)) {
    const field = def.shape[key];
    if (ctx.io === "input" ? inputOptin(field) === void 0 : field._zod.optout === void 0) {
      requiredKeys.push(key);
    }
  }
  if (requiredKeys.length > 0) {
    json.required = requiredKeys;
  }
  if (def.catchall?._zod.def.type === "never") {
    json.additionalProperties = false;
  } else if (!def.catchall) {
    if (ctx.io === "output")
      json.additionalProperties = false;
  } else if (def.catchall) {
    json.additionalProperties = processSchema(def.catchall, ctx, {
      ...params,
      path: [...params.path, "additionalProperties"]
    });
  }
};
var unionProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  const isExclusive = def.inclusive === false;
  const options = def.options.map((x, i) => processSchema(x, ctx, {
    ...params,
    path: [...params.path, isExclusive ? "oneOf" : "anyOf", i]
  }));
  if (isExclusive) {
    json.oneOf = options;
  } else {
    json.anyOf = options;
  }
};
var intersectionProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  const a = processSchema(def.left, ctx, {
    ...params,
    path: [...params.path, "allOf", 0]
  });
  const b = processSchema(def.right, ctx, {
    ...params,
    path: [...params.path, "allOf", 1]
  });
  const isSimpleIntersection = (val) => "allOf" in val && Object.keys(val).length === 1;
  const allOf = [
    ...isSimpleIntersection(a) ? a.allOf : [a],
    ...isSimpleIntersection(b) ? b.allOf : [b]
  ];
  json.allOf = allOf;
  ctx.intersections.push(allOf);
};
var tupleProcessor = (schema, ctx, _json, params) => {
  const json = _json;
  const def = schema._zod.def;
  json.type = "array";
  const prefixPath = ctx.target === "draft-2020-12" ? "prefixItems" : "items";
  const restPath = ctx.target === "draft-2020-12" ? "items" : ctx.target === "openapi-3.0" ? "items" : "additionalItems";
  const prefixItems = def.items.map((x, i) => processSchema(x, ctx, {
    ...params,
    path: [...params.path, prefixPath, i]
  }));
  const rest = def.rest ? processSchema(def.rest, ctx, {
    ...params,
    path: [...params.path, restPath, ...ctx.target === "openapi-3.0" ? [def.items.length] : []]
  }) : null;
  let minItems = def.items.length;
  while (minItems > 0) {
    const item = def.items[minItems - 1];
    const optional2 = ctx.io === "input" ? inputOptin(item) !== void 0 : item._zod.optout === "optional";
    if (!optional2)
      break;
    minItems--;
  }
  const maxItems = def.items.length;
  const isClosed = !def.rest;
  if (ctx.target === "draft-2020-12") {
    json.prefixItems = prefixItems;
    if (isClosed) {
      json.items = false;
    } else if (rest) {
      json.items = rest;
    }
    if (minItems > 0)
      json.minItems = minItems;
    if (isClosed)
      json.maxItems = maxItems;
  } else if (ctx.target === "openapi-3.0") {
    json.items = {
      anyOf: prefixItems
    };
    if (rest) {
      json.items.anyOf.push(rest);
    }
    if (minItems > 0)
      json.minItems = minItems;
    if (isClosed)
      json.maxItems = maxItems;
  } else {
    json.items = prefixItems;
    if (isClosed) {
      json.additionalItems = false;
    } else if (rest) {
      json.additionalItems = rest;
    }
    if (minItems > 0)
      json.minItems = minItems;
    if (isClosed)
      json.maxItems = maxItems;
  }
  const { minimum, maximum } = aggregateChecks(schema);
  if (typeof minimum === "number")
    json.minItems = minimum;
  if (typeof maximum === "number")
    json.maxItems = maximum;
};
function stringifyKeyNames(bySchema, json, visited) {
  if (json.$ref) {
    if (visited.has(json))
      return json;
    visited.add(json);
    const def = bySchema.get(json)?.def;
    if (!def)
      return json;
    const inlined = stringifyKeyNames(bySchema, def, visited);
    return inlined === def ? json : inlined;
  }
  for (const keyword of ["anyOf", "oneOf"]) {
    const branches = json[keyword];
    if (!Array.isArray(branches))
      continue;
    const mapped = branches.map((branch) => stringifyKeyNames(bySchema, branch, visited));
    if (mapped.some((branch, i) => branch !== branches[i]))
      json = { ...json, [keyword]: mapped };
  }
  const types = Array.isArray(json.type) ? json.type : [json.type];
  const numericType = !types.includes("string") && types.some((t) => t === "number" || t === "integer");
  const values = json.enum ?? (json.const !== void 0 ? [json.const] : void 0);
  if (!numericType && !values?.some((v) => typeof v === "number"))
    return json;
  const { minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf, format, id, ...rest } = json;
  if (rest.enum)
    rest.enum = rest.enum.map((v) => typeof v === "number" ? String(v) : v);
  else if (typeof rest.const === "number")
    rest.const = String(rest.const);
  if (!numericType)
    return rest;
  rest.type = "string";
  if (!values)
    rest.pattern = (types.includes("number") ? number : integer).source;
  return rest;
}
var pendingRecords = /* @__PURE__ */ new WeakMap();
function rewriteKeyNames(ctx) {
  const bySchema = /* @__PURE__ */ new Map();
  for (const entry of ctx.seen.values()) {
    if (entry.def && !bySchema.has(entry.schema))
      bySchema.set(entry.schema, entry);
  }
  const rewrites = /* @__PURE__ */ new Map();
  for (const record of pendingRecords.get(ctx) ?? []) {
    const seen = ctx.seen.get(record);
    const names = (seen?.def ?? seen?.schema)?.propertyNames;
    if (!names || names === true || rewrites.has(names))
      continue;
    const rewritten = stringifyKeyNames(bySchema, names, /* @__PURE__ */ new Set());
    if (rewritten !== names)
      rewrites.set(names, rewritten);
  }
  if (!rewrites.size)
    return;
  for (const entry of ctx.seen.values()) {
    for (const carrier of [entry.schema, entry.def]) {
      const rewritten = carrier && rewrites.get(carrier.propertyNames);
      if (rewritten)
        carrier.propertyNames = rewritten;
    }
  }
}
var recordProcessor = (schema, ctx, _json, params) => {
  const json = _json;
  const def = schema._zod.def;
  json.type = "object";
  const keyType = def.keyType;
  const patterns = aggregateChecks(keyType).patterns;
  if (def.mode === "loose" && patterns && patterns.size > 0) {
    const valueSchema = processSchema(def.valueType, ctx, {
      ...params,
      path: [...params.path, "patternProperties", "*"]
    });
    json.patternProperties = {};
    for (const pattern of patterns) {
      assignProp(json.patternProperties, exactPattern(pattern).source, valueSchema);
    }
  } else {
    if (ctx.target === "draft-07" || ctx.target === "draft-2020-12") {
      json.propertyNames = processSchema(def.keyType, ctx, {
        ...params,
        path: [...params.path, "propertyNames"]
      });
      let pending = pendingRecords.get(ctx);
      if (!pending) {
        pending = [];
        pendingRecords.set(ctx, pending);
        ctx.deferred.push(() => rewriteKeyNames(ctx));
      }
      pending.push(schema);
    }
    json.additionalProperties = processSchema(def.valueType, ctx, {
      ...params,
      path: [...params.path, "additionalProperties"]
    });
  }
  const keyValues = keyType._zod.values;
  const omittableOnInput = ctx.io === "input" && inputOptin(def.valueType) !== void 0;
  if (keyValues && !def.partial && !omittableOnInput) {
    const validKeyValues = [...keyValues].filter((v) => typeof v === "string" || typeof v === "number");
    if (validKeyValues.length > 0) {
      json.required = validKeyValues.map(String);
    }
  }
};
var nullableProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  const inner = processSchema(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  if (ctx.target === "openapi-3.0") {
    seen.ref = def.innerType;
    json.nullable = true;
  } else {
    json.anyOf = [inner, { type: "null" }];
  }
};
var nonoptionalProcessor = (schema, ctx, _json, params) => {
  const def = schema._zod.def;
  processSchema(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
};
var UNREPRESENTABLE_DEFAULT = /* @__PURE__ */ Symbol();
function serializeDefaultValue(value, schema, ctx, json, params) {
  let unrepresentable = false;
  const serialized = JSON.stringify(value, (_, val) => {
    if (typeof val !== "bigint")
      return val;
    unrepresentable = true;
    return null;
  });
  if (!unrepresentable)
    return JSON.parse(serialized);
  handleUnrepresentable(schema, ctx, json, params, "BigInt defaults cannot be represented in JSON Schema");
  return UNREPRESENTABLE_DEFAULT;
}
var defaultProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  processSchema(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  const value = serializeDefaultValue(def.defaultValue, schema, ctx, json, params);
  if (value !== UNREPRESENTABLE_DEFAULT)
    json.default = value;
};
var prefaultProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  processSchema(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  if (ctx.io !== "input")
    return;
  const value = serializeDefaultValue(def.defaultValue, schema, ctx, json, params);
  if (value !== UNREPRESENTABLE_DEFAULT)
    json._prefault = value;
};
var catchProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  processSchema(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  let catchValue;
  try {
    catchValue = def.catchValue(void 0);
  } catch {
    handleUnrepresentable(schema, ctx, json, params, "Dynamic catch values are not supported in JSON Schema");
    return;
  }
  json.default = catchValue;
};
var pipeProcessor = (schema, ctx, _json, params) => {
  const def = schema._zod.def;
  const inIsTransform = def.in._zod.traits.has("$ZodTransform");
  const innerType = ctx.io === "input" ? inIsTransform ? def.out : def.in : def.out;
  processSchema(innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = innerType;
};
var readonlyProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  processSchema(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  json.readOnly = true;
};
var promiseProcessor = (schema, ctx, _json, params) => {
  const def = schema._zod.def;
  processSchema(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
};
var optionalProcessor = (schema, ctx, _json, params) => {
  const def = schema._zod.def;
  processSchema(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
};
var lazyProcessor = (schema, ctx, _json, params) => {
  const innerType = schema._zod.innerType;
  processSchema(innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = innerType;
};
var allProcessors = {
  string: stringProcessor,
  number: numberProcessor,
  boolean: booleanProcessor,
  bigint: bigintProcessor,
  symbol: symbolProcessor,
  null: nullProcessor,
  undefined: undefinedProcessor,
  void: voidProcessor,
  never: neverProcessor,
  any: anyProcessor,
  unknown: unknownProcessor,
  date: dateProcessor,
  enum: enumProcessor,
  literal: literalProcessor,
  nan: nanProcessor,
  template_literal: templateLiteralProcessor,
  file: fileProcessor,
  success: successProcessor,
  custom: customProcessor,
  function: functionProcessor,
  transform: transformProcessor,
  map: mapProcessor,
  set: setProcessor,
  array: arrayProcessor,
  object: objectProcessor,
  union: unionProcessor,
  intersection: intersectionProcessor,
  tuple: tupleProcessor,
  record: recordProcessor,
  nullable: nullableProcessor,
  nonoptional: nonoptionalProcessor,
  default: defaultProcessor,
  prefault: prefaultProcessor,
  catch: catchProcessor,
  pipe: pipeProcessor,
  readonly: readonlyProcessor,
  promise: promiseProcessor,
  optional: optionalProcessor,
  lazy: lazyProcessor
};
function toJSONSchema(input, params) {
  if ("_idmap" in input) {
    const registry2 = input;
    const ctx2 = initializeContext({ ...params, processors: allProcessors });
    const defs = {};
    for (const entry of registry2._idmap.entries()) {
      const [_, schema] = entry;
      processSchema(schema, ctx2);
    }
    const schemas = {};
    const external = {
      registry: registry2,
      uri: params?.uri,
      defs
    };
    ctx2.external = external;
    for (const entry of registry2._idmap.entries()) {
      const [key, schema] = entry;
      extractDefs(ctx2, schema);
      assignProp(schemas, key, finalize(ctx2, schema));
    }
    if (Object.keys(defs).length > 0) {
      const defsSegment = ctx2.target === "draft-2020-12" ? "$defs" : "definitions";
      schemas.__shared = {
        [defsSegment]: defs
      };
    }
    return { schemas };
  }
  const ctx = initializeContext({ ...params, processors: allProcessors });
  processSchema(input, ctx);
  extractDefs(ctx, input);
  return finalize(ctx, input);
}

// node_modules/zod/v4/classic/errors.js
var _installedErrorProtos = /* @__PURE__ */ new WeakSet([Object.prototype, Error.prototype]);
function _lazyMethod(proto, key, make) {
  Object.defineProperty(proto, key, {
    configurable: true,
    enumerable: false,
    get() {
      const value = make(this);
      Object.defineProperty(this, key, { value, configurable: true, writable: true });
      return value;
    },
    set(value) {
      Object.defineProperty(this, key, { value, configurable: true, writable: true });
    }
  });
}
var initializer2 = (inst, issues) => {
  $ZodError.init(inst, issues);
  inst.name = "ZodError";
  const proto = Object.getPrototypeOf(inst);
  if (_installedErrorProtos.has(proto))
    return;
  _installedErrorProtos.add(proto);
  _lazyMethod(proto, "format", (self) => (mapper) => formatError(self, mapper));
  _lazyMethod(proto, "flatten", (self) => (mapper) => flattenError(self, mapper));
  _lazyMethod(proto, "addIssue", (self) => (issue2) => {
    self.issues.push(issue2);
    self.message = JSON.stringify(self.issues, jsonStringifyReplacer, 2);
  });
  _lazyMethod(proto, "addIssues", (self) => (issues2) => {
    self.issues.push(...issues2);
    self.message = JSON.stringify(self.issues, jsonStringifyReplacer, 2);
  });
  Object.defineProperty(proto, "isEmpty", {
    configurable: true,
    enumerable: false,
    get() {
      return this.issues.length === 0;
    }
  });
};
var ZodRealError = /* @__PURE__ */ $constructor("ZodError", initializer2, void 0, {
  Parent: Error
});

// node_modules/zod/v4/classic/parse.js
var parse6 = /* @__PURE__ */ _parse2(ZodRealError);
var parseAsync = /* @__PURE__ */ _parseAsync(ZodRealError);
var safeParse = /* @__PURE__ */ _safeParse(ZodRealError);
var safeParseAsync = /* @__PURE__ */ _safeParseAsync(ZodRealError);
var encode = /* @__PURE__ */ _encode(ZodRealError);
var decode = /* @__PURE__ */ _decode(ZodRealError);
var encodeAsync = /* @__PURE__ */ _encodeAsync(ZodRealError);
var decodeAsync = /* @__PURE__ */ _decodeAsync(ZodRealError);
var safeEncode = /* @__PURE__ */ _safeEncode(ZodRealError);
var safeDecode = /* @__PURE__ */ _safeDecode(ZodRealError);
var safeEncodeAsync = /* @__PURE__ */ _safeEncodeAsync(ZodRealError);
var safeDecodeAsync = /* @__PURE__ */ _safeDecodeAsync(ZodRealError);

// node_modules/zod/v4/classic/schemas.js
function _ensureDefaultLocale() {
  if (!globalConfig.localeError)
    config(en_default());
}
function _ensureDefaultMemoizer() {
  if (!globalConfig.memoizer)
    config({ memoizer: memoizer() });
}
var ZodType = /* @__PURE__ */ $constructor("ZodType", (inst, def) => {
  _ensureDefaultLocale();
  $ZodType.init(inst, def);
  inst.def = def;
  inst.type = def.type;
  return inst;
}, {
  check(...chks) {
    const def = this.def;
    return this.clone(util_exports.mergeDefs(def, {
      checks: [
        ...def.checks ?? [],
        ...chks.map((ch) => typeof ch === "function" ? { _zod: { check: ch, def: { check: "custom" }, onattach: [] } } : ch)
      ]
    }), { parent: true });
  },
  with(...chks) {
    return this.check(...chks);
  },
  clone(def, params) {
    return clone(this, def, params);
  },
  brand() {
    return this;
  },
  register(reg, meta2) {
    reg.add(this, meta2);
    return this;
  },
  refine(check, params) {
    return this.check(refine(check, params));
  },
  superRefine(refinement, params) {
    return this.check(superRefine(refinement, params));
  },
  overwrite(fn) {
    return this.check(_overwrite(fn));
  },
  optional() {
    return optional(this);
  },
  exactOptional() {
    return exactOptional(this);
  },
  nullable() {
    return nullable(this);
  },
  nullish() {
    return optional(nullable(this));
  },
  nonoptional(params) {
    return nonoptional(this, params);
  },
  array() {
    return array(this);
  },
  or(arg) {
    return union([this, arg]);
  },
  and(arg) {
    return intersection(this, arg);
  },
  transform(tx) {
    return pipe(this, transform(tx));
  },
  default(d) {
    return _default(this, d);
  },
  prefault(d) {
    return prefault(this, d);
  },
  catch(params) {
    return _catch(this, params);
  },
  pipe(target) {
    return pipe(this, target);
  },
  readonly() {
    return readonly(this);
  },
  describe(description) {
    const cl = this.clone();
    globalRegistry.add(cl, { description });
    return cl;
  },
  meta(...args) {
    if (args.length === 0)
      return globalRegistry.get(this);
    const cl = this.clone();
    globalRegistry.add(cl, args[0]);
    return cl;
  },
  isOptional() {
    return this.safeParse(void 0).success;
  },
  isNullable() {
    return this.safeParse(null).success;
  },
  apply(fn, ...args) {
    return args.length === 0 ? fn(this) : fn(this, ...args);
  },
  // Overrides core's `~standard` to add `jsonSchema`. Must stay a prototype entry: redefining it per instance demotes instances to dictionary mode.
  get "~standard"() {
    return util_exports.hide(this, "~standard", {
      ...standardProps(this),
      jsonSchema: {
        input: createStandardJSONSchemaMethod(this, "input"),
        output: createStandardJSONSchemaMethod(this, "output")
      }
    });
  },
  set "~standard"(value) {
    util_exports.own(this, "~standard", value);
  },
  parse: function _parse3(data, params) {
    return parse6(this, data, params, { callee: _parse3 });
  },
  parseAsync: async function _parseAsync2(data, params) {
    return await parseAsync(this, data, params, { callee: _parseAsync2 });
  },
  safeParse(data, params) {
    return safeParse(this, data, params);
  },
  async safeParseAsync(data, params) {
    return safeParseAsync(this, data, params);
  },
  // `spa` is an alias: same function object as `safeParseAsync`, as before.
  get spa() {
    return this?.safeParseAsync;
  },
  set spa(value) {
    util_exports.own(this, "spa", value);
  },
  validate(data, params) {
    return validate(this, data, params);
  },
  validateAsync(data, params) {
    return validateAsync(this, data, params);
  },
  encode: function _encode2(data, params) {
    return encode(this, data, params, { callee: _encode2 });
  },
  decode: function _decode2(data, params) {
    return decode(this, data, params, { callee: _decode2 });
  },
  encodeAsync: async function _encodeAsync2(data, params) {
    return await encodeAsync(this, data, params, { callee: _encodeAsync2 });
  },
  decodeAsync: async function _decodeAsync2(data, params) {
    return await decodeAsync(this, data, params, { callee: _decodeAsync2 });
  },
  safeEncode(data, params) {
    return safeEncode(this, data, params);
  },
  safeDecode(data, params) {
    return safeDecode(this, data, params);
  },
  async safeEncodeAsync(data, params) {
    return safeEncodeAsync(this, data, params);
  },
  async safeDecodeAsync(data, params) {
    return safeDecodeAsync(this, data, params);
  },
  toJSONSchema(params) {
    return createToJSONSchemaMethod(this, {})(params);
  },
  // Reads through to the registry on every access, so it must not cache.
  get description() {
    return globalRegistry.get(this)?.description;
  },
  // No setter: `schema._def = x` throws, as it did when `_def` was a non-writable own property.
  get _def() {
    return this._zod.def;
  }
});
var _ZodString = /* @__PURE__ */ $constructor(
  "_ZodString",
  (inst, def) => {
    $ZodString.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => stringProcessor(inst, ctx, json, params);
  },
  /* @__PURE__ */ util_exports.derived({
    format: (inst) => aggregateChecks(inst).format ?? null,
    minLength: (inst) => aggregateChecks(inst).minimum ?? null,
    maxLength: (inst) => aggregateChecks(inst).maximum ?? null
  }, {
    regex(...args) {
      return this.check(_regex(...args));
    },
    includes(...args) {
      return this.check(_includes(...args));
    },
    startsWith(...args) {
      return this.check(_startsWith(...args));
    },
    endsWith(...args) {
      return this.check(_endsWith(...args));
    },
    min(...args) {
      return this.check(_minLength(...args));
    },
    max(...args) {
      return this.check(_maxLength(...args));
    },
    length(...args) {
      return this.check(_length(...args));
    },
    nonempty(...args) {
      return this.check(_minLength(1, ...args));
    },
    lowercase(params) {
      return this.check(_lowercase(params));
    },
    uppercase(params) {
      return this.check(_uppercase(params));
    },
    trim() {
      return this.check(_trim());
    },
    normalize(...args) {
      return this.check(_normalize(...args));
    },
    toLowerCase() {
      return this.check(_toLowerCase());
    },
    toUpperCase() {
      return this.check(_toUpperCase());
    },
    slugify() {
      return this.check(_slugify());
    }
  })
);
var ZodString = /* @__PURE__ */ $constructor("ZodString", (inst, def) => {
  $ZodString.init(inst, def);
  _ZodString.init(inst, def);
}, {
  email(params) {
    return this.check(_email(ZodEmail, params));
  },
  url(params) {
    return this.check(_url(ZodURL, params));
  },
  jwt(params) {
    return this.check(_jwt(ZodJWT, params));
  },
  emoji(params) {
    return this.check(_emoji2(ZodEmoji, params));
  },
  guid(params) {
    return this.check(_guid(ZodGUID, params));
  },
  uuid(params) {
    return this.check(_uuid(ZodUUID, params));
  },
  uuidv4(params) {
    return this.check(_uuidv4(ZodUUID, params));
  },
  uuidv6(params) {
    return this.check(_uuidv6(ZodUUID, params));
  },
  uuidv7(params) {
    return this.check(_uuidv7(ZodUUID, params));
  },
  nanoid(params) {
    return this.check(_nanoid(ZodNanoID, params));
  },
  cuid(params) {
    return this.check(_cuid(ZodCUID, params));
  },
  cuid2(params) {
    return this.check(_cuid2(ZodCUID2, params));
  },
  ulid(params) {
    return this.check(_ulid(ZodULID, params));
  },
  base64(params) {
    return this.check(_base64(ZodBase64, params));
  },
  base64url(params) {
    return this.check(_base64url(ZodBase64URL, params));
  },
  xid(params) {
    return this.check(_xid(ZodXID, params));
  },
  ksuid(params) {
    return this.check(_ksuid(ZodKSUID, params));
  },
  ipv4(params) {
    return this.check(_ipv4(ZodIPv4, params));
  },
  ipv6(params) {
    return this.check(_ipv6(ZodIPv6, params));
  },
  cidrv4(params) {
    return this.check(_cidrv4(ZodCIDRv4, params));
  },
  cidrv6(params) {
    return this.check(_cidrv6(ZodCIDRv6, params));
  },
  e164(params) {
    return this.check(_e164(ZodE164, params));
  },
  datetime(params) {
    return this.check(_isoDateTime(ZodISODateTime, params));
  },
  date(params) {
    return this.check(_isoDate(ZodISODate, params));
  },
  time(params) {
    return this.check(_isoTime(ZodISOTime, params));
  },
  duration(params) {
    return this.check(_isoDuration(ZodISODuration, params));
  }
});
function string2(params) {
  return _string(ZodString, params);
}
var ZodStringFormat = /* @__PURE__ */ $constructor("ZodStringFormat", (inst, def) => {
  $ZodStringFormat.init(inst, def);
  _ZodString.init(inst, def);
});
var ZodISODateTime = /* @__PURE__ */ $constructor("ZodISODateTime", (inst, def) => {
  $ZodISODateTime.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodISODate = /* @__PURE__ */ $constructor("ZodISODate", (inst, def) => {
  $ZodISODate.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodISOTime = /* @__PURE__ */ $constructor("ZodISOTime", (inst, def) => {
  $ZodISOTime.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodISODuration = /* @__PURE__ */ $constructor("ZodISODuration", (inst, def) => {
  $ZodISODuration.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodEmail = /* @__PURE__ */ $constructor("ZodEmail", (inst, def) => {
  $ZodEmail.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodGUID = /* @__PURE__ */ $constructor("ZodGUID", (inst, def) => {
  $ZodGUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodUUID = /* @__PURE__ */ $constructor("ZodUUID", (inst, def) => {
  $ZodUUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodURL = /* @__PURE__ */ $constructor("ZodURL", (inst, def) => {
  $ZodURL.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodEmoji = /* @__PURE__ */ $constructor("ZodEmoji", (inst, def) => {
  $ZodEmoji.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodNanoID = /* @__PURE__ */ $constructor("ZodNanoID", (inst, def) => {
  $ZodNanoID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodCUID = /* @__PURE__ */ $constructor("ZodCUID", (inst, def) => {
  $ZodCUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodCUID2 = /* @__PURE__ */ $constructor("ZodCUID2", (inst, def) => {
  $ZodCUID2.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodULID = /* @__PURE__ */ $constructor("ZodULID", (inst, def) => {
  $ZodULID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodXID = /* @__PURE__ */ $constructor("ZodXID", (inst, def) => {
  $ZodXID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodKSUID = /* @__PURE__ */ $constructor("ZodKSUID", (inst, def) => {
  $ZodKSUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodIPv4 = /* @__PURE__ */ $constructor("ZodIPv4", (inst, def) => {
  $ZodIPv4.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodIPv6 = /* @__PURE__ */ $constructor("ZodIPv6", (inst, def) => {
  $ZodIPv6.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodCIDRv4 = /* @__PURE__ */ $constructor("ZodCIDRv4", (inst, def) => {
  $ZodCIDRv4.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodCIDRv6 = /* @__PURE__ */ $constructor("ZodCIDRv6", (inst, def) => {
  $ZodCIDRv6.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodBase64 = /* @__PURE__ */ $constructor("ZodBase64", (inst, def) => {
  $ZodBase64.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodBase64URL = /* @__PURE__ */ $constructor("ZodBase64URL", (inst, def) => {
  $ZodBase64URL.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodE164 = /* @__PURE__ */ $constructor("ZodE164", (inst, def) => {
  $ZodE164.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodJWT = /* @__PURE__ */ $constructor("ZodJWT", (inst, def) => {
  $ZodJWT.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodNumber = /* @__PURE__ */ $constructor(
  "ZodNumber",
  (inst, def) => {
    $ZodNumber.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => numberProcessor(inst, ctx, json, params);
    inst.isFinite = true;
  },
  /* @__PURE__ */ util_exports.derived({
    minValue: (inst) => {
      const { minimum, exclusiveMinimum } = aggregateChecks(inst);
      return Math.max(minimum ?? Number.NEGATIVE_INFINITY, exclusiveMinimum ?? Number.NEGATIVE_INFINITY);
    },
    maxValue: (inst) => {
      const { maximum, exclusiveMaximum } = aggregateChecks(inst);
      return Math.min(maximum ?? Number.POSITIVE_INFINITY, exclusiveMaximum ?? Number.POSITIVE_INFINITY);
    },
    isInt: (inst) => {
      const { isInt, multipleOf } = aggregateChecks(inst);
      return !!isInt || !!multipleOf?.some(Number.isSafeInteger);
    },
    format: (inst) => aggregateChecks(inst).format ?? null
  }, {
    gt(value, params) {
      return this.check(_gt(value, params));
    },
    gte(value, params) {
      return this.check(_gte(value, params));
    },
    min(value, params) {
      return this.check(_gte(value, params));
    },
    lt(value, params) {
      return this.check(_lt(value, params));
    },
    lte(value, params) {
      return this.check(_lte(value, params));
    },
    max(value, params) {
      return this.check(_lte(value, params));
    },
    int(params) {
      return this.check(int(params));
    },
    safe(params) {
      return this.check(int(params));
    },
    positive(params) {
      return this.check(_gt(0, params));
    },
    nonnegative(params) {
      return this.check(_gte(0, params));
    },
    negative(params) {
      return this.check(_lt(0, params));
    },
    nonpositive(params) {
      return this.check(_lte(0, params));
    },
    multipleOf(value, params) {
      return this.check(_multipleOf(value, params));
    },
    step(value, params) {
      return this.check(_multipleOf(value, params));
    },
    finite() {
      return this;
    }
  })
);
function number2(params) {
  return _number(ZodNumber, params);
}
var ZodNumberFormat = /* @__PURE__ */ $constructor("ZodNumberFormat", (inst, def) => {
  $ZodNumberFormat.init(inst, def);
  ZodNumber.init(inst, def);
});
function int(params) {
  return _int(ZodNumberFormat, params);
}
var ZodBoolean = /* @__PURE__ */ $constructor("ZodBoolean", (inst, def) => {
  $ZodBoolean.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => booleanProcessor(inst, ctx, json, params);
});
function boolean2(params) {
  return _boolean(ZodBoolean, params);
}
var ZodUnknown = /* @__PURE__ */ $constructor("ZodUnknown", (inst, def) => {
  $ZodUnknown.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => unknownProcessor(inst, ctx, json, params);
});
function unknown() {
  return _unknown(ZodUnknown);
}
var ZodNever = /* @__PURE__ */ $constructor("ZodNever", (inst, def) => {
  $ZodNever.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => neverProcessor(inst, ctx, json, params);
});
function never(params) {
  return _never(ZodNever, params);
}
var ZodArray = /* @__PURE__ */ $constructor("ZodArray", (inst, def) => {
  _ensureDefaultMemoizer();
  $ZodArray.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => arrayProcessor(inst, ctx, json, params);
  inst.element = def.element;
}, {
  min(n, params) {
    return this.check(_minLength(n, params));
  },
  nonempty(params) {
    return this.check(_minLength(1, params));
  },
  max(n, params) {
    return this.check(_maxLength(n, params));
  },
  length(n, params) {
    return this.check(_length(n, params));
  },
  unwrap() {
    return this.element;
  }
});
function array(element, params) {
  return _array(ZodArray, element, params);
}
var ZodObject = /* @__PURE__ */ $constructor("ZodObject", (inst, def) => {
  _ensureDefaultMemoizer();
  $ZodObjectJIT.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => objectProcessor(inst, ctx, json, params);
  util_exports.installLazyProp(inst, "shape", (self) => self._zod.def.shape, false);
}, {
  keyof() {
    return _enum(Object.keys(this._zod.def.shape));
  },
  catchall(catchall) {
    return this.clone(util_exports.mergeDefs(this._zod.def, { catchall }));
  },
  passthrough() {
    return this.clone(util_exports.mergeDefs(this._zod.def, { catchall: unknown() }));
  },
  loose() {
    return this.clone(util_exports.mergeDefs(this._zod.def, { catchall: unknown() }));
  },
  strict() {
    return this.clone(util_exports.mergeDefs(this._zod.def, { catchall: never() }));
  },
  strip() {
    return this.clone(util_exports.mergeDefs(this._zod.def, { catchall: void 0 }));
  },
  extend(incoming) {
    return util_exports.extend(this, incoming);
  },
  safeExtend(incoming) {
    return util_exports.safeExtend(this, incoming);
  },
  merge(other) {
    return util_exports.merge(this, other);
  },
  pick(mask) {
    return util_exports.pick(this, mask);
  },
  omit(mask) {
    return util_exports.omit(this, mask);
  },
  partial(...args) {
    return util_exports.partial(ZodOptional, this, args[0]);
  },
  exactPartial(...args) {
    return util_exports.partial(ZodExactOptional, this, args[0], "exactPartial");
  },
  required(...args) {
    return util_exports.required(ZodNonOptional, this, args[0]);
  }
});
function object(shape, params) {
  const def = {
    type: "object",
    shape: shape ?? {},
    ...util_exports.normalizeParams(params)
  };
  return new ZodObject(def);
}
var ZodUnion = /* @__PURE__ */ $constructor("ZodUnion", (inst, def) => {
  $ZodUnion.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => unionProcessor(inst, ctx, json, params);
  inst.options = def.options;
});
function union(options, params) {
  return new ZodUnion({
    type: "union",
    options,
    ...util_exports.normalizeParams(params)
  });
}
var ZodIntersection = /* @__PURE__ */ $constructor("ZodIntersection", (inst, def) => {
  $ZodIntersection.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => intersectionProcessor(inst, ctx, json, params);
});
function intersection(left, right) {
  return new ZodIntersection({
    type: "intersection",
    left,
    right
  });
}
var ZodEnum = /* @__PURE__ */ $constructor("ZodEnum", (inst, def) => {
  $ZodEnum.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => enumProcessor(inst, ctx, json, params);
  inst.enum = def.entries;
  inst.options = [...inst._zod.values];
  const keys = new Set(Object.keys(def.entries));
  inst.extract = (values, params) => {
    const newEntries = {};
    for (const value of values) {
      if (keys.has(value)) {
        newEntries[value] = def.entries[value];
      } else
        throw new Error(`Key ${value} not found in enum`);
    }
    return new ZodEnum({
      ...def,
      checks: [],
      ...util_exports.normalizeParams(params),
      entries: newEntries
    });
  };
  inst.exclude = (values, params) => {
    const newEntries = { ...def.entries };
    for (const value of values) {
      if (keys.has(value)) {
        delete newEntries[value];
      } else
        throw new Error(`Key ${value} not found in enum`);
    }
    return new ZodEnum({
      ...def,
      checks: [],
      ...util_exports.normalizeParams(params),
      entries: newEntries
    });
  };
});
function _enum(values, params) {
  const entries = Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values;
  return new ZodEnum({
    type: "enum",
    entries,
    ...util_exports.normalizeParams(params)
  });
}
var ZodLiteral = /* @__PURE__ */ $constructor("ZodLiteral", (inst, def) => {
  $ZodLiteral.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => literalProcessor(inst, ctx, json, params);
  inst.values = new Set(def.values);
  Object.defineProperty(inst, "value", {
    get() {
      if (def.values.length > 1) {
        throw new Error("This schema contains multiple valid literal values. Use `.values` instead.");
      }
      return def.values[0];
    }
  });
});
function literal(value, params) {
  return new ZodLiteral({
    type: "literal",
    values: Array.isArray(value) ? value : [value],
    ...util_exports.normalizeParams(params)
  });
}
var ZodTransform = /* @__PURE__ */ $constructor("ZodTransform", (inst, def) => {
  _ensureDefaultMemoizer();
  $ZodTransform.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => transformProcessor(inst, ctx, json, params);
  inst._zod.parse = (payload, _ctx) => {
    if (_ctx.direction === "backward") {
      throw new $ZodEncodeError(inst.constructor.name);
    }
    payload.addIssue = (issue2) => {
      if (typeof issue2 === "string") {
        payload.issues.push(util_exports.issue(issue2, payload.value, def));
      } else {
        const _issue = issue2;
        if (_issue.fatal)
          _issue.continue = false;
        _issue.code ?? (_issue.code = "custom");
        if (!("input" in _issue))
          _issue.input = payload.value;
        _issue.inst ?? (_issue.inst = inst);
        payload.issues.push(util_exports.issue(_issue));
      }
    };
    const output = def.transform(payload.value, payload);
    if (output instanceof Promise) {
      return output.then((output2) => {
        payload.value = output2;
        return payload;
      });
    }
    payload.value = output;
    return payload;
  };
});
function transform(fn) {
  return new ZodTransform({
    type: "transform",
    transform: fn
  });
}
var ZodOptional = /* @__PURE__ */ $constructor("ZodOptional", (inst, def) => {
  $ZodOptional.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function optional(innerType) {
  return new ZodOptional({
    type: "optional",
    innerType
  });
}
var ZodExactOptional = /* @__PURE__ */ $constructor("ZodExactOptional", (inst, def) => {
  $ZodExactOptional.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function exactOptional(innerType) {
  return new ZodExactOptional({
    type: "optional",
    innerType
  });
}
var ZodNullable = /* @__PURE__ */ $constructor("ZodNullable", (inst, def) => {
  $ZodNullable.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => nullableProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function nullable(innerType) {
  return new ZodNullable({
    type: "nullable",
    innerType
  });
}
var ZodDefault = /* @__PURE__ */ $constructor("ZodDefault", (inst, def) => {
  $ZodDefault.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => defaultProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
  inst.removeDefault = inst.unwrap;
});
function _default(innerType, defaultValue) {
  return new ZodDefault({
    type: "default",
    innerType,
    get defaultValue() {
      return typeof defaultValue === "function" ? defaultValue() : util_exports.shallowClone(defaultValue);
    }
  });
}
var ZodPrefault = /* @__PURE__ */ $constructor("ZodPrefault", (inst, def) => {
  $ZodPrefault.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => prefaultProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function prefault(innerType, defaultValue) {
  return new ZodPrefault({
    type: "prefault",
    innerType,
    get defaultValue() {
      return typeof defaultValue === "function" ? defaultValue() : util_exports.shallowClone(defaultValue);
    }
  });
}
var ZodNonOptional = /* @__PURE__ */ $constructor("ZodNonOptional", (inst, def) => {
  $ZodNonOptional.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => nonoptionalProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function nonoptional(innerType, params) {
  return new ZodNonOptional({
    type: "nonoptional",
    innerType,
    ...util_exports.normalizeParams(params)
  });
}
var ZodCatch = /* @__PURE__ */ $constructor("ZodCatch", (inst, def) => {
  $ZodCatch.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => catchProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
  inst.removeCatch = inst.unwrap;
});
function _catch(innerType, catchValue) {
  return new ZodCatch({
    type: "catch",
    innerType,
    catchValue: typeof catchValue === "function" ? catchValue : util_exports.constantCatch(catchValue)
  });
}
var ZodPipe = /* @__PURE__ */ $constructor("ZodPipe", (inst, def) => {
  $ZodPipe.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => pipeProcessor(inst, ctx, json, params);
  inst.in = def.in;
  inst.out = def.out;
});
function pipe(in_, out) {
  return new ZodPipe({
    type: "pipe",
    in: in_,
    out
    // ...util.normalizeParams(params),
  });
}
var ZodReadonly = /* @__PURE__ */ $constructor("ZodReadonly", (inst, def) => {
  $ZodReadonly.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => readonlyProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function readonly(innerType) {
  return new ZodReadonly({
    type: "readonly",
    innerType
  });
}
var ZodCustom = /* @__PURE__ */ $constructor("ZodCustom", (inst, def) => {
  $ZodCustom.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => customProcessor(inst, ctx, json, params);
});
function refine(fn, _params = {}) {
  return _refine(ZodCustom, fn, _params);
}
function superRefine(fn, params) {
  return _superRefine(fn, params);
}

// src/server/schemas/settings.ts
var ruleLoadingTier = _enum(["minimal", "balanced", "full", "custom"]);
var disciplineProfile = _enum(["auto", "off", "essential", "full"]);
var enforcementMode = _enum(["advisory", "hard-stop"]);
var autonomyMode = _enum(["on", "off", "auto"]);
var userType = _enum(["", "consultant", "creator", "developer", "finance", "founder", "gtm", "ops"]);
var profileId = _enum(["developer", "content_creator", "founder", "agency", "finance", "ops"]);
var accessStyle = _enum(["getters_setters", "get_attribute", "magic_properties"]);
var chatFreq = _enum(["per_turn", "per_phase", "per_tool"]);
var qualityCadence = _enum(["end_of_roadmap", "per_phase", "per_step"]);
var fidelityMode = _enum(["strict", "structural", "hard-floor"]);
var replyMethod = _enum(["replies_endpoint", "create_review_comment", "auto"]);
var confidenceBand = _enum(["off", "low", "medium", "high"]);
var onBlock = _enum(["stop", "ask", "warn"]);
var modelAutoSwitch = _enum(["auto", "suggest", "off"]);
var projectionMode = _enum(["legacy-all", "scoped"]);
var projectAudience = _enum(["self", "internal", "client", "public"]);
var deliveryMerge = _enum(["off", "on-green"]);
var prTopology = _enum(["single", "stacked"]);
var gitCommitFormat = _enum(["ticket-scope", "ticket-conventional"]);
var gitUpdateStrategy = _enum(["merge", "rebase"]);
var settingsSchema = object({
  agent_config_version: string2().default("").describe(
    'Pin the package to an exact semver (e.g. "1.4.2") so all teammates load the same skill / rule set. Leave empty to track whatever is installed locally \u2014 useful for the maintainers of this package, risky for production projects.'
  ),
  profile: object({
    id: profileId.default("developer").describe(
      "Which experience you run \u2014 the audience identity that selects your default skill / command surface, README entry-path, and persona pre-selection (ADR-010, docs/contracts/profile-system.md). Six seed profiles: developer \xB7 content_creator \xB7 founder \xB7 agency \xB7 finance \xB7 ops. This is the first wizard question. In 6.0.0-A it records the choice only; pack-scoped surfacing (projection-time filtering, ADR-040) activates in 6.0.0-B behind a staged, opt-in rollout. Switch later with `agent-config use --profile=<id>`."
    )
  }).prefault({ id: "developer" }),
  projection: object({
    mode: projectionMode.default("legacy-all").describe(
      "Whether the per-tool projector writes EVERY artefact into the host-tool trees (.claude/ .cursor/ .windsurf/) or only the active profile + packs' artefacts (ADR-040, docs/contracts/capability-packs.md). legacy-all = (default, non-breaking) project the full surface exactly as 5.x did. scoped = project only the active profile's packs unioned with the runtime.active_packs overlay, expanded over the requires graph \u2014 opt in with `agent-config use --profile=<id>`. A failed scoped projection restores the full tree."
    ),
    rule_packs: union([literal("auto"), array(string2())]).default([]).describe(
      'Scoping axis for the RULE layer beyond the derived workspace set, per pack ids (src/config/discovery/packs.yml). When set, a non-kernel rule also needs a packs frontmatter intersection to ship \u2014 e.g. deselecting frontend-design drops ui-audit-gate + design-fidelity. Opt-in, and an empty list is inactive; the workspace axis beside it is derived rather than configured (ADR-293 step 4.6). The literal "auto" derives the id list from the active-pack set (the same set the skill/command prune uses), so a domain safety floor stops shipping into installs that do not have the pack it guards; an explicit list stays supported and wins over the derivation.'
    )
  }).prefault({ mode: "legacy-all" }),
  rule_loading_tier: ruleLoadingTier.default("balanced").describe(
    "Master switch for which rule tiers load and how cautiously the agent spends tokens. minimal = only the 9 kernel rules (cheapest, fewest guardrails). balanced = kernel + tier-1 (recommended default). full = kernel + tier-1 + tier-2 (most guardrails, highest token cost). custom = roll your own in agents/overrides/. LEGACY: superseded by discipline_profile \u2014 when that key is set it wins (mapping: minimal\u2192off, balanced\u2192essential, full\u2192full)."
  ),
  discipline_profile: disciplineProfile.optional().describe(
    "The ONE runtime knob for the discipline-rule tier (successor of rule_loading_tier; council 2026-07-07). off = kernel only (~1x tokens). essential = kernel + the measured lift-carrying rules (~3.3x, keeps the weak-host discipline lift). full = everything (~11.7x, EXPERIMENTAL \u2014 residual lift over essential not established). auto = resolve per session against the evidence-gated NULL-lift disable-list in src/config/host-capabilities.yml (measured-null host \u2192 off, otherwise \u2192 essential). Optional and opt-in until the P1/P2 evidence gates pass (agents/roadmaps/road-to-discipline-profile-tiering.md); absent = legacy rule_loading_tier applies."
  ),
  cost: object({
    budgets: object({
      daily: number2().min(0).default(0).describe(
        "Daily USD ceiling across all model calls. The agent warns at 50% / 75% / 90% and either stops or warns at 100% depending on cost.enforcement. Set 0 to disable the daily budget entirely."
      ),
      weekly: number2().min(0).default(0).describe(
        "Rolling 7-day USD ceiling. Same alert ladder as cost.budgets.daily but useful when work bursts unevenly across the week. Set 0 to disable."
      ),
      monthly: number2().min(0).default(0).describe(
        "Calendar-month USD ceiling. Pairs with cost.enforcement = hard-stop for a hard cap on agent spend before the next billing cycle. Set 0 to disable."
      ),
      per_tier: object({
        cheap: number2().min(0).nullable().default(null).describe(
          "USD ceiling for the cheap model tier. Budget-aware delegation was ARCHIVED 2026-08-16 (docs/contracts/budget-routing.md), so no code routes on this today; the cap is still summed and reported by `budget.mjs tier`. null = no separate tier cap; global ceilings still apply."
        ),
        medium: number2().min(0).nullable().default(null).describe(
          "USD ceiling for the medium model tier. null = no separate tier cap."
        ),
        strong: number2().min(0).nullable().default(null).describe(
          "USD ceiling for the strong model tier. null = no separate tier cap. The never-block-to-save-money relation this used to describe went with the archived budget-routing layer (docs/contracts/budget-routing.md); nothing routes between tiers today."
        )
      }).prefault({ cheap: null, medium: null, strong: null })
    }),
    enforcement: enforcementMode.default("advisory").describe(
      "What happens when a budget hits 100%. advisory = show a banner, keep working (default \u2014 never blocks an active task). hard-stop = refuse further model calls until the budget resets or you raise the ceiling."
    )
  }),
  model: object({
    auto_switch: modelAutoSwitch.default("suggest").describe(
      "Per-skill model auto-switch (ADR-035). Skills declare a vendor-neutral model_tier (lite/medium/high); the generator maps it to a native Claude model (high\u2192opus, medium\u2192sonnet, lite\u2192haiku). suggest (default) = never emit a native Claude model: key; the model-recommendation rule names the tier as a one-question suggestion on every surface \u2014 your explicit /model choice is never silently overridden. auto = render a native Claude model: into lite/medium/high-tier skills so Claude Code switches automatically for that turn (reverts next prompt), and suggest on surfaces without a native override. off = inert, no native key and no suggestion."
    )
  }).prefault({ auto_switch: "suggest" }),
  personal: object({
    ide: string2().default("").describe(
      "CLI binary your IDE registers (code, code-insiders, phpstorm, cursor, windsurf, idea, subl, \u2026). Used by the file-editor skill to open edited files. Leave empty to disable IDE integration."
    ),
    open_edited_files: boolean2().default(false).describe(
      "After the agent edits a file, run `<ide> <path>` to surface it in your editor immediately. Off by default to avoid window-stealing during long agent runs."
    ),
    rtk_installed: boolean2().default(false).describe(
      "Does this machine have rtk (Rust Token Killer, a third-party Apache-2.0 tool: https://github.com/rtk-ai/rtk) on PATH \u2014 verified as the real Token Killer, not the unrelated Rust Type Kit that shares the binary name? When true the agent wraps verbose CLI output (git, tests, linters, docker, npm, composer) with rtk (upstream reports 60-90% token savings \u2014 their estimate). Leave false if rtk is missing \u2014 the agent falls back to tail / grep. The wizard overwrites this from a live two-stage probe (PATH presence + `rtk gain` identity check)."
    ),
    canary_name: string2().default("").describe(
      'Session canary \u2014 the name the agent addresses you with at the start of every new task (e.g. "Alex"). When the greeting silently disappears, the context window is degrading: start a fresh conversation. Also keeps the reply-close markers (end-summary, PR URL as literal last line) alive. Empty = fall back to the user-global canary_name, then to identity.name from the setup wizard; no name anywhere = off. See rules/session-canary.md.'
    ),
    pr_progress_comments: boolean2().default(false).describe(
      'Permit the agent to post unsolicited progress / status comments on an open PR (e.g. "CI fix iteration #2", "still blocked on workflow scope"). Default off \u2014 most teammates find them noisy. User-invoked flows (/fix:pr-comments, /create-pr, /code-review, explicit "post a comment that \u2026") are NOT gated by this setting. See rules/no-pr-progress-comments.md.'
    ),
    autonomy: autonomyMode.default("auto").describe(
      'How aggressively the agent suppresses trivial workflow questions ("commit now?", "open PR?"). on = silently pick the sensible default. off = always ask. auto (default) = decide per project, on for solo / off when collaborators are involved. The Hard Floor (prod, deploys, bulk deletes) ignores this setting and always asks.'
    ),
    user_type: userType.default("").describe(
      "Optional persona axis used by the skill-suggester to surface the relevant subset (consultant / creator / developer / finance / founder / gtm / ops). Empty = no filter, all skills available. You can change this any time without re-running setup."
    )
  }),
  project: object({
    upstream_repo: string2().default("").describe(
      "GitHub slug (owner/repo) the upstream-contribute skill targets when you ask the agent to push a learning back to the shared agent-config package. Empty = improvement PRs are disabled."
    ),
    improvement_pr_branch_prefix: string2().default("improve/agent-").describe(
      'Branch-name prefix for improvement PRs the agent opens against project.upstream_repo (e.g. "improve/agent-add-react-skill"). Pick a prefix your repo conventions allow.'
    ),
    audience: projectAudience.default("public").describe(
      'Who this project is built for \u2014 read by the demand gate (\xA7 8-pre of docs/guidelines/agent-infra/agent-interaction-and-decision-quality.md), whose L0-L4 ladder measures MARKET demand and is meaningless where no market is intended. self = a tool its maintainer builds for themselves; the gate is inert and work is classified L-self (build) instead of being deferred for lack of a user population nobody wants. internal = a team tool; only "what breaks without it?" survives. client = built for a named client, who is the requester rather than a market segment. public (default) = a product with an intended market; full three-question gate, behaviour unchanged from before this key existed.'
    )
  }),
  git: object({
    commit_format: gitCommitFormat.default("ticket-scope").describe(
      "Where a ticket id goes in a commit subject. ticket-scope (default) = the ticket is the Conventional-Commits scope, `feat(DEV-1234): add export filter` \u2014 the behaviour every install had before this key existed. ticket-conventional = the ticket leads the subject and the scope names the system area, `DEV-1234 feat(exporter): add export filter`; a ticket is then never a scope. Without a ticket both shapes are plain Conventional Commits. A commit-linting config in the repository (commitlint, a commit-msg hook) outranks this key."
    ),
    branch_pattern: string2().default("{type}/{slug}").describe(
      "Shape of a branch name the agent creates. Placeholders: {type} (feat, fix, \u2026), {ticket} (e.g. DEV-1234), {slug} (short kebab-case description). Default {type}/{slug}. {slug} is required, and characters outside the placeholders are limited to A-Z a-z 0-9 . _ / - so a rendered name is safe in a command; agent-config git:convention show reports anything else as invalid. A team that names branches after the ticket sets {ticket}-{slug}. A placeholder with no value is dropped together with the separator that follows it, or the one before it when it is last, so no name starts or ends with a separator ({type}/{ticket}-{slug} without a ticket gives feat/slug). Reading a ticket back out of an existing branch never depends on this pattern."
    ),
    update_strategy: gitUpdateStrategy.default("merge").describe(
      "How a feature branch is brought up to date with its base. merge (default) = merge the base into the branch, as before this key existed. rebase = rebase the branch onto origin/<base> and publish with --force-with-lease, never a merge of the base into the branch. Rebase rewrites history, so the agent still asks for it unless the git-history-discipline rule already authorises the rewrite (the user asked this turn, an unrevoked standing instruction, or a pull --rebase the user started); this key decides which operation is proposed, never whether one is authorised."
    )
  }).prefault({}),
  github: object({
    pr_reply_method: replyMethod.default("create_review_comment").describe(
      "How the agent replies to PR review comments. create_review_comment = post a new review comment (works on every GitHub plan). replies_endpoint = thread the reply under the original comment (needs the newer REST endpoint). auto = detect at runtime, prefer threaded replies when available."
    )
  }),
  delivery: object({
    merge: deliveryMerge.default("off").describe(
      "Whether a run may merge the pull request it produced. off (default) = the run ends at mergeable-green-and-open and says so. on-green = merge is permitted, and only when an object-bound grant covering {op: prod_merge, target: <base>} exists and the final head is required-check-green, target-current and tamper-checked. This key is a precondition, never the authorisation by itself; forge auto-merge is the mechanism, so branch protection stays the gate."
    ),
    wait_for_ci: boolean2().default(true).describe(
      "Whether the run stays alive until the required checks settle. true (default) = the run drives CI and reports the settled verdict. false = the run ends once the branch is pushed and the PR is open, leaving the checks to be read later. Independent of merge: a run may wait for CI without being allowed to merge."
    ),
    pr_topology: prTopology.default("single").describe(
      "How a mission's work is shaped into pull requests. single (default) = one branch, one pull request. stacked = a dependent series. stacked is never chosen by the agent and never asked about at roadmap creation \u2014 the owner plans it or it does not happen."
    )
  }),
  /**
   * What this package may write into the HOST's own environment.
   *
   * THE GUARANTEE IS THE SHAPE, not a check. Only two keys exist here, and
   * both are request-SIZE caps. Neither traffic variable is expressible —
   * `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` and `DISABLE_AUTOUPDATER` both
   * reach the host's update-disabled resolver (the blanket one as its third
   * rung, measured on Claude Code 2.1.284), so a profile able to write either
   * could disable a consumer's security updates. Owner-decided 2026-09-30:
   * they are not writable through this package at all, and the strongest way
   * to hold that is a schema that cannot say them rather than an exclusion
   * list somebody has to maintain.
   *
   * `null` is the default on both, and it is the off switch: nothing is
   * written. There is no separate enable flag, because a flag plus a value is
   * two ways to say off and one of them would drift.
   */
  host_environment: object({
    request_size_caps: object({
      bash_max_output_length: number2().int().positive().max(15e4).nullable().default(null).describe(
        "Character cap on Bash tool output the host places inline into a model request. null (default) = this package writes nothing and the host default of 30000 applies. A number is written into the host env block. Values above 150000 are capped by the host itself, so the schema refuses them here rather than writing a value the host silently changes. Bounds request SIZE, never request COUNT: lowering it suppresses no telemetry, no update check and no download."
      ),
      max_mcp_output_tokens: number2().int().positive().nullable().default(null).describe(
        "Token cap on a single MCP tool result the host places into a model request. null (default) = nothing written, host default 25000 applies. Same size-not-count caveat: it does not govern MCP connections, timeouts, or whether a tool runs."
      )
    }).prefault({}).describe(
      "Request-size caps this package may write into the host env block. Both null by default. No traffic or auto-updater variable is expressible here, by construction \u2014 see the block comment."
    )
  }).prefault({}).describe(
    'What this package may write into the host environment. ABSENT resolves to the all-null shape, which is the same thing as off \u2014 a settings file predating this section must not fail to parse, and "no section" and "both caps null" both mean write nothing.'
  ),
  augment: object({
    rules_use_symlinks: boolean2().default(false).describe(
      "When true, .augment/rules/*.md are symlinks into dist/agent-src/rules/ \u2014 edits flow back to source on save. When false (default), they are copies \u2014 safer on Windows and shared volumes, but rule edits in .augment/ are lost on the next `task sync`."
    )
  }),
  eloquent: object({
    access_style: accessStyle.default("getters_setters").describe(
      'How the agent writes Laravel Eloquent property access. getters_setters = explicit getName() / setName() methods (most refactor-safe). get_attribute = $model->getAttribute("name") (verbose but explicit). magic_properties = $model->name (idiomatic but harder to grep).'
    )
  }),
  chat_history: object({
    enabled: boolean2().default(true).describe(
      "Persist a structured log of every chat turn to agents/runtime/.agent-chat-history (JSONL). Recording only \u2014 no command in this package replays a session from the file; it is a record on disk that a human or a later tool can read. Turn off if you never want chat transcripts on disk."
    ),
    frequency: chatFreq.default("per_turn").describe(
      "How often the chat-history writer flushes to disk. per_turn = after every user / agent exchange (default, lowest data loss on crash). per_phase = at phase boundaries (cheaper I/O). per_tool = after every tool call (highest fidelity, noisiest log)."
    ),
    text_limits: object({
      user: number2().int().min(0).default(0).describe(
        "Per-message character cap for user inputs in the chat-history log. 0 = log verbatim (default). Raise above 0 only if your prompts contain large pasted artefacts you do not want stored."
      ),
      agent: number2().int().min(0).default(5e3).describe(
        "Per-message character cap for agent replies in the chat-history log. Truncates with an ellipsis past the cap. Lower to shrink history files, raise for long-reasoning replies."
      ),
      tool: number2().int().min(0).default(200).describe(
        "Per-call character cap for tool input / output blobs in the chat-history log. The default 200 keeps history files compact while preserving enough signal to replay a session."
      ),
      phase: number2().int().min(0).default(200).describe(
        "Per-marker character cap for phase markers (Phase=Refine, Phase=Plan, \u2026) in the chat-history log. Rarely needs tuning."
      )
    })
  }),
  roadmap: object({
    quality_cadence: qualityCadence.default("per_phase").describe(
      "When the agent runs the full quality / test suite during /roadmap:process-* runs. per_phase = after each phase boundary (default since 2026-09-13 \u2014 end_of_roadmap lets errors compound across phases, which is expensive in a multi-phase autonomous run nobody is watching). end_of_roadmap = once, after the last step (fastest). per_step = after every single step (slowest, highest confidence)."
    ),
    horizon_weeks: number2().int().min(0).default(0).describe(
      'Optional planning horizon (weeks) the agent shows in roadmap framing ("next 4 weeks"). Set 0 to omit the horizon \u2014 most teams prefer to ship without a hardcoded window.'
    ),
    gate_budget: object({
      // `.min(0)` is kept deliberately, at a known cost: the settings-
      // reference generator renders a constrained nullable number as
      // type `unknown` rather than `number,null` (it reads `node.type`,
      // which a constrained nullable emits as an `anyOf` instead).
      // Eight keys already render that way. Dropping the constraint
      // would buy a nicer doc cell by letting a negative USD ceiling
      // into the schema, and a cap that refuses everything is a worse
      // outcome than an uninformative table cell.
      max_cost_per_run_usd: number2().min(0).nullable().default(null).describe(
        "Per-run USD ceiling for a CLASS-1 roadmap blocker executed via `agent-config gates --execute`. A class-1 entry whose **Budget:** field states a larger figure renders its consent line instead of running. null (default) = no per-run ceiling, per ADR-279: a spend bound applies only where one was set, and the absence of a bound is not a refusal. Bounds the size of an authorised spend; never supplies the authorisation \u2014 `--confirm` is still required on every class-1 run, set or unset."
      ),
      max_cost_per_rolling_7d_usd: number2().min(0).nullable().default(null).describe(
        "Rolling 7-day USD ceiling for class-1 gate execution, summed from the append-only receipt ledger at agents/runtime/state/gate-budget-ledger.jsonl. A run whose estimate would cross it renders instead of running. null (default) = no rolling ceiling, per ADR-279. A per-run cap alone bounds one mistake, not a week of them, which is why option (a) of b-gate-budget-preauth carries two numbers \u2014 but each cap now bounds on its own, so setting one and leaving the other null is supported."
      )
    }).prefault({ max_cost_per_run_usd: null, max_cost_per_rolling_7d_usd: null })
  }),
  planning: object({
    closure_pass: boolean2().default(true).describe(
      `Gate C \u2014 plan-closure pass. true (default) = a plan-artifact ask (/roadmap:create, roadmap-writing, /feature:plan, /feature:roadmap, /roadmap:materialize, /implement-ticket, /jira-ticket, /analyze:inbox, /analyze:roadmap-repos) ends in a closure pass (/challenge-me closure): every foreseeable decision is closed at the lowest rung that owns it and written into the roadmap's "## Decisions" table, so a long run never meets a question planning could have closed. false = inert, plan asks author directly. An explicit user bypass always wins for that turn and is counted as a bypass rather than as an absent closure.`
    ),
    risk_review: boolean2().default(true).describe(
      'Gate R1 \u2014 plan-risk review. true (default) = every ready (non-draft) plan must carry a schema-valid "## Risk Register" section (ranked risks, mitigation + anchor per row, freshness marker, exact honest-null grammar), enforced by lint_plan_risk_register at pre-push + CI. false = escape hatch, the validator skips.'
    ),
    completion_review: boolean2().default(true).describe(
      "Gate R2 \u2014 completion review at 100% roadmap completion / pre-PR. true (default) = a findings-before-fixes review by a fresh reviewer context must exist for the current diff hash (or an exact honest-null / skip declaration) before fix commits and PR creation, enforced by check_completion_review at pre-push + CI (CI authoritative; a crashed validator warns and allows). false = escape hatch, the validator skips."
    )
  }).prefault({}),
  execution: object({
    fix_loop_max: number2().int().min(1).default(10).describe(
      "Consecutive failed fix attempts against one validation target before the escalation ladder reaches its terminal rung. Reaching the bound triggers a strategy change, never a question. Overridable globally, per project and per prompt."
    ),
    escalation: array(string2()).default(["independent", "council", "team", "owner_owned_check"]).describe(
      "The escalation rungs, in order, walked when the fix-loop bound is reached: independent (another session or a provider-diverse reviewer), council, team, then owner_owned_check \u2014 which asks whether the residue is owner-owned, not whether to ask the owner now."
    )
  }).prefault({}),
  quality: object({
    local_auto_run: boolean2().default(false).describe(
      "Run quality tools (linters, type-checks, formatters) and the local test suite autonomously after edits, IN CHAT. Off by default \u2014 in a chat turn a human is present and remote CI is the authoritative gate, so a local full-pipeline run duplicates it at wall-clock cost. The agent only runs a quality tool on an explicit ask, a concrete CI failure, or the new-gate carve-out. A mission is governed by local_auto_run_in_mission instead."
    ),
    local_auto_run_in_mission: boolean2().default(true).describe(
      "Run quality tools autonomously inside a mission \u2014 an autonomous roadmap run with a claimed contract. On by default: nobody is waiting, the next action belongs to the agent itself, and a red found twenty steps later costs more than the run that would have caught it at step one. Inert outside a mission, and a mission never lowers local_auto_run: true."
    )
  }),
  design: object({
    fidelity_mode: fidelityMode.default("strict").describe(
      "How strictly the agent must follow a user-provided prototype / mockup / design system (consumed by the design-fidelity rule). strict = build 1:1, every visible deviation needs confirmation; structural = structure locked, silent gaps fillable with a stated assumption; hard-floor = any deviation is never autonomous."
    ),
    approximation: object({
      enabled: boolean2().default(false).describe(
        "Whether a value INSIDE the configured tolerance may be replaced by the project's own token without a per-value confirmation. Ships false. The distance from the artifact's value to the nearest project token is computed and REPORTED on every value row regardless of this switch \u2014 what it decides is whether the agent may act on it without asking. Turning it on for a whole install is a consumer-facing default flip and is owner-reserved (agents/roadmaps/stubs/road-to-frontend-power-default-flip.md); design.fidelity_mode: hard-floor overrides it to off."
      ),
      tolerance: object({
        color: number2().nullable().default(null).describe(
          'Colour distance below which a value may be reconciled, in OKLab \u0394EOK. Ships null, and null means "preserve and report" rather than "reconcile freely". No number is set because none is supported: zero of seven design-to-code benchmarks in the evidence set score token conformance, and a number in a config file \u2014 even flagged unmeasured \u2014 shapes behavior and acquires the authority of a default. Not an RGB channel delta: RGB distance is not perceptually uniform.'
        ),
        length: number2().nullable().default(null).describe(
          "Length distance below which a value may be reconciled, in absolute CSS pixels. Ships null, same reasoning as color. GitHub Primer's \xB11px spacing widening is recorded as an externally observed candidate in src/scripts/_lib/design_tolerance.ts and is deliberately not the shipped value; max(1px, 2%) was rejected for growing more permissive at large dimensions with no evidence that this is wanted."
        )
      }).prefault({ color: null, length: null })
    }).prefault({ enabled: false, tolerance: { color: null, length: null } })
  }).prefault({
    fidelity_mode: "strict",
    approximation: { enabled: false, tolerance: { color: null, length: null } }
  }),
  code_graph: object({
    consumer_index_paths: array(string2()).default([]).describe(
      "Extra project-relative paths where THIS project keeps a code-graph index another tool wrote. The built-in list is deliberately vendor-neutral (graph.json, code-graph.json, .code-graph/graph.json) and names no tool, so a tool that writes its index elsewhere is named here rather than waited for. A graph found this way LOADS and answers query and explain with every edge tagged read-from-elsewhere; the gate verbs (impact, untested, dead) refuse a graph made only of such edges and say so, because an empty answer from a gate must not read as 'nothing found' when it means 'nothing trusted'. Absolute paths and paths escaping the project root are ignored."
    )
  }).prefault({}),
  screenshots: object({
    identity_allowlist: array(string2()).default([]).describe(
      "Consumed by the doc-screenshot-hygiene rule and screenshot-hygiene skill. Public identity tokens SAFE to show unredacted in a documentation screenshot \u2014 the maintainer's own public handles plus well-known fake-data tokens. Not a general fake-data dictionary and not identity-resolution: everything not listed is treated as sensitive by default, and a public handle co-located with a real name does not whitelist the real name. Default [] = nothing auto-allowed."
    ),
    forbid_terminal_capture: boolean2().default(true).describe(
      "Consumed by the doc-screenshot-hygiene rule. true (default) = terminal/CLI/IDE screenshots are forbidden (highest leak vector: absolute local paths, env tokens); use text code blocks with text redaction instead. false = allowed, still subject to the data-bearing human gate."
    ),
    data_bearing_gate: _enum(["on", "off"]).default("on").describe(
      "Consumed by the doc-screenshot-hygiene rule. on (default) = a data-bearing screenshot embed is gated behind this-turn human confirmation; uncertain/unresolved regions redact-or-refuse, never ship-and-hope; illustrative/no-data screenshots may embed with a stated justification. off = no data-bearing gate (the anonymization taxonomy still applies)."
    )
  }).prefault({ identity_allowlist: [], forbid_terminal_capture: true, data_bearing_gate: "on" }),
  verbosity: object({
    offer_council_in_delivery: boolean2().default(false).describe(
      'Offer "run AI Council on this?" inside delivery commands (/feature-plan, /review-changes, /roadmap-create). Council commands themselves are unaffected.'
    )
  }).prefault({ offer_council_in_delivery: false }),
  code_style: object({
    docblocks: _enum(["minimal", "full"]).default("minimal").describe(
      "Consumed by the code-comment-discipline rule. minimal (default) = no signature-mirroring docblocks; docblocks only for machine-relevant precision (generics, array shapes) or genuine why-context. full = the exported public surface of a library package may carry one-line summary docblocks; the redundancy ban still holds."
    )
  }).prefault({ docblocks: "minimal" }),
  reasoning: object({
    enabled: boolean2().default(true).describe(
      "Master switch for the Reasoning Discipline Protocol (RDP). false = the whole layer is inert (zero overhead)."
    )
  }).prefault({}),
  subagents: object({
    quota_arbitrage: boolean2().default(true).describe(
      "Prefer a separate quota-pool model for delegable sub-tasks where the host manifest reports one. Optional bonus only \u2014 identical behaviour (minus the quota win) where unsupported. Never load-bearing."
    ),
    model_map: object({
      lite: string2().default("").describe("Model alias for lite-tier sub-tasks. Empty = the tier runtime default."),
      medium: string2().default("").describe("Model alias for medium-tier sub-tasks. Empty = the tier runtime default."),
      high: string2().default("").describe("Model alias for high-tier sub-tasks. Empty = the tier runtime default.")
    }).prefault({}).describe(
      "Per-tier model map for downshift routing. Each empty value uses the tier runtime default (no vendor model baked in)."
    ),
    implementer_model: string2().default("").describe(
      "Override the model the orchestrator dispatches to subagents that write code (e.g. claude-sonnet-4, gpt-5). Empty (default) = inherit the session's primary model \u2014 cheapest and usually right."
    ),
    judge_model: string2().default("").describe(
      "Override the model used for review / judge subagents that critique implementer output. Empty (default) = one tier above the implementer model \u2014 picks up nuance the implementer missed."
    ),
    model_ceiling: string2().default("").describe(
      "Session-wide model CEILING for subagents (spend cap). Empty (default) = no ceiling. When set, suite-owned CLI spawn wrappers export CLAUDE_CODE_SUBAGENT_MODEL to the sessions they launch. Class C: a human sets it; the agent never writes or infers one."
    ),
    max_parallel: number2().int().min(1).max(64).default(3).describe(
      "Limit on subagents running in parallel during /do-in-parallel, /do-competitively, and /judge runs. On Claude Code the installer also writes it into CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS, the host cap on concurrent new spawns. That cap does not bound a resumed worker: on Claude Code 2.1.306 a resume was admitted past a cap of 1, so a resume is neither bounded by the host nor counted by any package code yet. Raise for faster fan-out, lower if you hit rate limits or want lower token spend."
    ),
    adversarial_council: _enum(["off", "ask", "on"]).default("off").describe(
      "Opt-in adversarial-verification-council mode (subagent-orchestration Mode 9, ADR-122). off (default) = never runs; ask = offer it on an explicit high-risk change; on = auto-run on high-risk changes. Advisory only \u2014 a panel of distinct-model skeptics red-teams a real change for defect FINDING coverage and NEVER auto-gates it (Hard Floor). Stays default-off until the adversarial-council-finding-coverage claim is backed."
    )
  }),
  // `worktrees.mode` was DELETED (ADR-229). Worktree creation is
  // instruction-only and hardcoded; there is nothing left to configure. A
  // leftover key is ignored with one deprecation line via REMOVED_KEYS.
  // `worktrees.cleanup` governs REMOVAL, a separate question (ADR-295).
  worktrees: object({
    cleanup: _enum(["off", "notify", "auto"]).default("notify").describe(
      "What the agent may do about a worktree whose work is provably on the trunk (merged by merge commit, rebase or squash), that is clean, holds no ignored file a rebuild would not restore, and has no live session. notify (default, and what an absent key resolves to) says once a day how many exist and removes nothing; auto removes them right after /pr:merge and once a day on the first session start, without force, keeping local branches; off says nothing. The daily pass reads merged pull requests through your gh login (branch name and head commit only)."
    )
  }).prefault({ cleanup: "notify" }),
  ai_team: object({
    model: string2().default("auto").describe(
      "Model handed to the codex CLI. 'auto' (default) = pass no --model flag so the CLI's own default applies \u2014 tracks the subscription's current strongest model instead of pinning a stale ID. Any other value passes through verbatim as `--model <value>`."
    ),
    allow_delegate: boolean2().default(false).describe(
      "Second opt-in for the only wrapper that delegates write access (/team:delegate). false (default) = delegate refuses even when /team itself is available. Availability (codex CLI installed + authenticated) is necessary but not sufficient \u2014 this key must ALSO be true before delegation is reachable."
    ),
    max_calls_per_day: number2().int().min(0).default(50).describe(
      "Per-day cap on team calls, read against the EXISTING cli_call_budget openai bucket (~/.event4u/agent-config/cli-calls.json, daily UTC reset) \u2014 one subscription, one counter, never a parallel count. 0 = block all team calls."
    ),
    review_gate: object({
      managed: boolean2().default(false).describe(
        "Managed governance of the codex plugin's Stop-hook Review Gate (road-to-team-mode Phase 4). false (default) = byte-identical pre-Phase-4 behavior: no counting, no circuit breaker. true = count consecutive BLOCK verdicts per session and trip the circuit breaker at max_consecutive_blocks."
      ),
      max_consecutive_blocks: number2().int().min(1).default(3).describe(
        "Circuit-breaker bound: after this many CONSECUTIVE BLOCK verdicts in one session, a visible notice is injected exactly once and the managed layer stops re-blocking \u2014 the user decides, never an infinite Claude\u2194Codex loop. An ALLOW verdict resets the counter. Positive integer."
      )
    }).prefault({ managed: false, max_consecutive_blocks: 3 })
  }).prefault({ model: "auto", allow_delegate: false, max_calls_per_day: 50, review_gate: { managed: false, max_consecutive_blocks: 3 } }),
  emergency: object({
    orchestration_halt: boolean2().default(false).describe(
      "The one audited incident switch over the always-on orchestration stack (subagents, council, team). NOT an activation gate: false (default) = the stack runs normally. true = halted; arming requires no ceremony. Disarming (returning to false) requires orchestration_halt_justification to be a non-empty string. Both transitions emit one telemetry line."
    ),
    orchestration_halt_justification: string2().default("").describe(
      "Required non-empty before orchestration_halt may return to false. Ignored while arming the halt."
    )
  }).prefault({ orchestration_halt: false, orchestration_halt_justification: "" }),
  onboarding: object({
    onboarded: boolean2().default(false).describe(
      "Set to true once the developer has completed `agent-config setup`. The onboarding-gate rule blocks the first turn of every chat until this is true. Toggle back to false to re-trigger the wizard."
    )
  }),
  commands: object({
    suggestion: object({
      blocklist: array(string2()).default([]).describe(
        'Slash-command names that should never be suggested, one per line (e.g. "commit", "create-pr"). Useful if a command misfires on your common phrasing.'
      )
    }),
    create_pr: object({
      preview_description: boolean2().default(false).describe(
        "When /create-pr runs, show the generated title and body and wait for confirmation before opening the PR. Off by default (zero-friction PR creation); turn on if you want a last-look gate."
      ),
      detail_level: _enum(["min", "med", "max"]).default("min").describe(
        "Verbosity tier for the generated PR description body. min (default) = title + 2-3 sentence what/why/impact + linked ticket (token-frugal); med = min + grouped changes + tests note; max = med + how-to-test + edge cases + reviewer guidance. Critical info (breaking changes, migrations, security, rollback) is ALWAYS included at every tier \u2014 the tier governs explanatory depth, never whether a critical callout appears."
      ),
      screenshots: boolean2().default(false).describe(
        "Screenshots for frontend changes. false (default) = never attempt. true = attempt when the host has browser/preview tooling and the diff touches a frontend surface; capability-gated (emits a one-line note and leaves the placeholder when tooling is absent, never fails or blocks the PR). Before/after + changed-region highlighting is best-effort."
      )
    })
  }),
  continuity: object({
    auto_record: _enum(["on", "off"]).default("on").describe(
      "Deterministic continuity-record writer at session end (road-to-continuity-writer-activation Phase 1). on (default since 2026-09-10) = the session-eol concern writes the continuity_record capsule variant on Stop for a substantive session that has claimed a roadmap; every field is computed from on-disk state, with no model spend and no subprocess. off = no automatic record, and only the explicit agent-config session:recycle writes one. The default flipped once the parity evidence landed, so the normal path carries an automatic writer rather than a remembered command; session:recycle is retained because the automatic writer skips a session that claimed no roadmap and omits the git-status anchors."
    ),
    run_checkpoints: _enum(["on", "off"]).default("on").describe(
      "Deterministic run-checkpoint production at session end (road-to-continuity-writer-activation Phase 1.4). on (default) = a session above the recycle threshold and inside a running roadmap contract leaves agents/runtime/state/checkpoints/<run>.json, so a killed run resumes from a derived checkpoint rather than from bookkeeping. off = no checkpoint; continuity writing, the recycle advisory and the context-fill surface are unaffected. Default ON because it is the behavior the tree already had \u2014 the switch exists to make the three session-end handlers independently disableable, not to change what ships."
    )
  }),
  retro: object({
    enabled: boolean2().default(true).describe(
      "Automatic retro after merged work (ADR-292, docs/contracts/retro-v1.md). true (default, owner directive 2026-10-12) = a merged PR and the first session of a new local day enqueue finished work; a deterministic triage picks what is worth one learning, and nothing behavior-changing is applied without a person. The one network read is the daily probe asking GitHub, through your own gh login, whether a pushed PR merged (repository and PR number only, three-second budget). false = no automatic path runs \u2014 no merge enqueue, no forge-merge marker, no daily probe and no network read; an explicit /retro still runs on request. Class C: an agent cannot set it; it cascades from the user-global file."
    )
  }).prefault({}),
  memory: object({
    redact_patterns: array(string2()).default([]).describe(
      "Regex patterns (one per line) that scrub matches from chat-history transcripts and memory before they hit disk. Use for secrets, customer names, internal URLs. Patterns are anchored and case-insensitive."
    ),
    session_index: _enum(["on", "off"]).default("off").describe(
      "Opt-in compact memory index at session start (road-to-memory-retrieval-economy P5). on = inject a compact id + title + ~tokens index of curated entries (hard cap 30 rows, bodies never included) through the hot-context hook; the agent fetches full entries via memory_get on demand. off (default) = no injection \u2014 the ship-criterion (measured hit-rate gain) is unproven, so off unless proven."
    ),
    learn_on_session_end: boolean2().default(false).describe(
      "session_end learning-sidecar aggregation (road-to-reachable-code-memory P4). true = the session_end hook aggregates agents/memory/intake/*.jsonl through the learning sidecar into the gitignored .agent-learning.json + LESSONS.md (local-only, 2 s budget, fail-open; promotion stays human via /memory:propose). false (default, council 2026-07-27) = no-op; the flip is proposed only after the 30-day dogfood shows non-trivial signal AND session-end p95 < 2 s."
    )
  }),
  knowledge: object({
    global_sharing: object({
      enabled: boolean2().default(true).describe(
        "Master switch for the file-first global knowledge-card store (ADR-100; default-ON per ADR-119, the validated bounded-downside flip superseding ADR-103 \u2014 write-time redaction incl. hidden-unicode hardening, narrowest tier default, pre-registered demotion trigger). User-global setting \u2014 keep in ~/.event4u/agent-config/agent-settings.yml. false fully no-ops the layer (single-key revert); project-local cards (v1) are unaffected."
      ),
      allowed_tiers: array(string2()).default(["public"]).describe(
        "Origin tiers auto-eligible to cross a project boundary. proprietary is manual-only regardless (the gate hard-codes it), so an in-house schema never auto-shares."
      )
    }).prefault({})
  }).prefault({}),
  egress: object({
    placeholders: object({
      mode: _enum(["off", "observe", "protect", "strict"]).default("off").describe(
        "Dispatcher egress stage (docs/contracts/egress-placeholders-v1.md). off (default) = nothing. observe = detect and count listed values in prompts and tool bodies, types and counts only, and change nothing a hook concern sees. protect = also give every recording and advisory concern a copy with each value replaced by a placeholder token, so local stores keep tokens; guards still see the original. strict = as protect until the host rewrite exists. No mode yet changes what reaches the model; the rule table holds credential rows and the validated identifier rows. Project layers only."
      )
    }).prefault({})
  }).prefault({}),
  hooks: object({
    concern_budget: object({
      tier1_concerns: array(string2()).default([]).describe(
        "Concern IDs (one per line) that are allowed to block the run on failure rather than warn. Reserved for high-confidence guards \u2014 leave empty unless you maintain custom hooks."
      )
    }),
    verify_before_complete: object({
      touched_file_quality: _enum(["off", "shadow", "warn"]).default("off").describe(
        "Stop-slot pass that runs the project's OWN quality commands \u2014 the ones resolve_toolchain() already reports \u2014 over the files this turn edited. Default off. `shadow` records a per-run result and emits nothing; `warn` adds ONE advisory line of at most 200 bytes. Never blocks and never counts as verification: a command recorded here never reaches _lib/verification_command.ts, so a clean eslint run cannot let a turn claim it verified anything. A writing command runs only in its check form (pint --test) or not at all, and a command with no per-file form is skipped rather than run project-wide at every stop."
      )
    }).prefault({}),
    injection_scan: object({
      enabled: boolean2().default(false).describe(
        "PostToolUse prompt-injection scanner (road-to-security-pillar.md P3.2). Default off. When on, scans tool output (file reads, web fetches, MCP responses) for injection signatures and WARNS in context (never blocks). Runtime backstop on top of the always-on untrusted-input-defense rule; detection is probabilistic."
      )
    }).prefault({}),
    runtime_journal: object({
      enabled: boolean2().default(false).describe(
        "Runtime event journal (road-to-runtime-event-journal Phase 1). Default off. When on, one durable, episode-keyed record per dispatched hook event is appended to <git-common-dir>/agent-journal/journal.sqlite \u2014 a Class-A write that opens, writes and exits. It emits nothing to the model, never warns and never blocks: a locked database, a missing node:sqlite, a malformed envelope or a full disk all degrade to silence. Off rather than on because it CREATES a storage surface (a SQLite database under your .git/) rather than appending to a directory that already exists. The record type has no field able to hold free-form content \u2014 ids, an event name, a bounded capability identifier, repo-relative locators and two 12-hex digests; no prompt, no file body, no absolute path. Retention: a 30-day TTL anchored on episode close, plus explicit, time-bounded, human-only holds that themselves expire."
      )
    }).prefault({}),
    rtk_wrap: object({
      enabled: boolean2().default(false).describe(
        'PreToolUse RTK-wrap nudge (token-saving Phase 3). Default off. When on AND the binary on PATH is verified as Rust Token Killer (a live two-stage identity probe \u2014 not a self-reported flag, and never a colliding same-name binary), warns (never blocks) "re-run wrapped with rtk" before a single verbose CLI command (git/npm/cargo/docker/\u2026) \u2014 upstream reports 60\u201390% output-token savings (their estimate). Skips completeness-critical / piped / compound commands and git diff. No-op when rtk is absent, unverified, or a different tool. Its own activation charge is one advisory line under the 1,024 B default concern cap in src/config/hook-token-budget.json; the per-fire distribution is UNMEASURED \u2014 stated rather than estimated, because the saving above is a third-party output-token claim and not a standing-payload reduction this package measured.'
      )
    }).prefault({}),
    design_slop: object({
      enabled: boolean2().default(false).describe(
        "PreToolUse anti-slop nudge (road-to-anti-slop-detector Phase 3). Default off. When on, runs the lint_design_slop registry against about-to-be-written UI content and WARNS (never blocks) on P0/P1 aesthetic tells (side-stripe, gradient-text, magic z-index, \u2026). Flags are rebuttable via DESIGN.md / design-slop-disable. Anti-loop: a file::rule signature surfaced 3x goes silent. Host-limited convenience layer; the universal gate is the lint_design_slop linter/CI."
      )
    }).prefault({}),
    design_pass: object({
      enabled: boolean2().default(false).describe(
        "PostToolUse + stop design pass (road-to-frontend-power E1.1/E1.2/E1.3). Default off. One concern on two slots: on post_tool_use a write to a UI surface delivers the design findings as context and never blocks; on stop the same pass runs over every UI file touched this session, deduped against what the post pass surfaced, and a P0 objective floor (contrast, font size, heading skip, focus) blocks with a continuation. P1-P3 never block. post_tool_use rather than pre_tool_use for two measured reasons: pre_tool_use is declared by three hosts and honoured by one while post_tool_use is declared by six, and _lib/ui_surface.ts is a path predicate, so a pre-write gate cannot fire on the first write of a new surface. A pass that could not fully run reports verification: degraded with a reason rather than passing silently. Does not replace design_slop: two design keys is the honest state until the tiering experiment has a number."
      )
    }).prefault({}),
    ui_route_nudge: object({
      enabled: boolean2().default(false).describe(
        "PreToolUse UI-route nudge (road-to-frontend-skill-application Phase 4). Default off. When on, a Write/Edit to a UI surface with no design consultation latched this session WARNS (never blocks) naming the route \u2014 run existing-ui-audit, then the fe-design loop. A read or search touching fe-design / existing-ui-audit / design-review / design-intelligence latches consultation and silences it for the session. Anti-loop: at most 2 nudges per session. It does not read the rules: the UI-surface decision comes from _lib/ui_surface.ts and no code parses rule frontmatter, so this runs parallel to the two UI rules rather than consuming their triggers, and a test keeps the sets from drifting. It is a nudge, so their enforced_by: none stays accurate."
      )
    }).prefault({}),
    code_graph: object({
      enabled: boolean2().default(false).describe(
        "PreToolUse code-graph nudge (ADR-124 Phase 4). Default off. When on AND a native code-graph cache or a consumer-shipped graph.json/SCIP index is present, warns once per session (never blocks) as the agent is about to Grep/Glob or Read a source file \u2014 query the graph first for who-calls/where-used/impact questions (or rebuild if stale, build if absent). Source G\u2019s strict block-first-read mode is deliberately un-ported."
      )
    }).prefault({}),
    suggestion_capture: object({
      enabled: boolean2().default(false).describe(
        'Suggestion-block capture (road-to-suggestion-block-capture Phase 2). Default off. Two slots: `stop` reads `last_assistant_message` \u2014 a payload field, so no transcript file is read \u2014 and latches that the assistant turn carried a numbered-options block; `user_prompt_submit` CONSUMES that latch and classifies the answering turn as option_n / as_is / other / stale_block. Consume-once is the correctness guard: the latch is deleted on read, so a bare "1" three turns later meets no latch and classifies `other`, and a latch past its TTL or unparseable is `stale_block` rather than a guess. Writes COUNTS ONLY to agents/runtime/state/audit/suggestion-capture.jsonl \u2014 the record type has no field able to hold a prompt, an option label or a command name, and a test asserts the written key set against src/config/suggestion-capture.json. Off by default because this is an INSTRUMENT rather than a feature: it exists so a capture rate can be measured on a maintainer workspace over a fixed soak window, and there is nothing in it for a consumer to gain.'
      )
    }).prefault({})
    // `turn_end_gate` is deliberately ABSENT. The stop-slot turn-end gate is
    // always armed (2026-08-12) and has no settings surface: whether it
    // fires is decided by each detector's own trigger conditions, not by a
    // flag. A leftover `hooks.turn_end_gate.*` block from an older install
    // warns once on stderr and is ignored — see REMOVED_KEYS in
    // `src/scripts/_lib/settings_removed_keys.ts`.
  }),
  decision_engine: object({
    min_confidence: confidenceBand.default("off").describe(
      "During Phase=Plan, refuse to advance to Phase=Implement if confidence is below this band. off (default) = no gate. low / medium / high = raise the floor; on miss, decision_engine.on_block decides what happens."
    ),
    block_on_risk: confidenceBand.default("off").describe(
      "During Phase=Implement, refuse to act when the risk class meets or exceeds this band. off (default) = no gate. low / medium / high = stricter ceilings; pairs with decision_engine.on_block."
    ),
    require_memory_hits: boolean2().default(false).describe(
      "During Phase=Refine, require at least one relevant memory hit (skill, ADR, past decision) before the agent proceeds. Off by default; turn on for highly conventional codebases where memory should always inform decisions."
    ),
    on_block: onBlock.default("stop").describe(
      "What the decision engine does when a gate (min_confidence / block_on_risk / require_memory_hits) fires. stop (default) = halt and surface the reason. ask = present numbered options. warn = log and continue."
    ),
    ask_timeout_seconds: number2().int().min(0).default(30).describe(
      "Non-TTY timeout (seconds) for decision_engine.on_block = ask. After this elapses without input, the engine stops (fail-safe). Default 30s; raise for slow human review, 0 = wait forever."
    )
  }),
  update_check: object({
    enabled: boolean2().default(true).describe(
      "Once per day the agent checks the npm registry for a newer agent-config release and surfaces a one-line banner if one exists. Turn off in air-gapped environments or to silence the banner."
    )
  }),
  advisories: object({
    mode: _enum(["off", "notify"]).default("notify").describe(
      "Whether the first session start of a day prints the advisory findings that need action today. notify (default) reads the local cache only \u2014 a session start never touches the network; off prints nothing, and agent-config audit:deps show still works."
    ),
    egress: _enum(["none", "query"]).default("query").describe(
      "What leaves the machine when agent-config audit:deps refresh runs. query (default) sends names and versions of public packages to api.osv.dev and reads endoflife.date and the PHP and Node release feeds; a private package name is never sent, and a native npm or composer audit, which sends the lockfile package list to the registry that tool is configured for, runs only for a lockfile with no private package. none sends nothing, and findings read unknown rather than clear."
    ),
    kev: _enum(["off", "on"]).default("on").describe(
      "Whether a refresh reads the CISA known-exploited catalog. on (default) downloads the whole catalog and matches it locally, so nothing about the project is sent, and a finding in it is raised one tier in a runtime scope; off leaves tiers to the other sources. Runs only where egress is query."
    )
  }).prefault({ mode: "notify", egress: "query", kev: "on" }),
  update: object({
    mode: _enum(["off", "notify", "ask", "auto"]).default("notify").describe(
      "What the agent may do about a newer release. notify tells you and installs nothing (the default, and what an absent key resolves to); ask behaves as notify until the ring-0 exit ships a prompt; auto installs a staged release at a session start when every gate passes and no other session is live; off says nothing at all. Read from the user-global layer only \u2014 a repository cannot set how your global install updates itself."
    )
  }).prefault({ mode: "notify" }),
  legal_review_prep: object({
    acknowledged: boolean2().default(false).describe(
      "I understand the legal-review-prep pack provides templates and general information ONLY \u2014 it is NOT legal advice, creates no attorney-client relationship, and never replaces a licensed lawyer. Individual cases require an attorney. The pack stays inactive until this is checked."
    ),
    require_council: boolean2().default(true).describe(
      "Gate legal work-product behind a multi-model AI-council / deep-research pass (defense-in-depth: documented multi-stage review + audit trail; fail-closed when no council is configured). Leave on for the safest posture. Turning it off lets single-model legal output through \u2014 not recommended for a high-risk pack."
    )
  }).prefault({ acknowledged: false, require_council: true })
});

// src/shared/zodJsonSchema.ts
function normalise(node2) {
  if (Array.isArray(node2)) {
    for (const n of node2) normalise(n);
    return;
  }
  if (typeof node2 !== "object" || node2 === null) return;
  const o = node2;
  if (o["properties"] !== void 0 && o["additionalProperties"] === void 0) o["additionalProperties"] = false;
  if (Array.isArray(o["enum"]) && o["type"] === void 0) {
    const kinds = new Set(o["enum"].map((v) => typeof v));
    if (kinds.size === 1 && (kinds.has("string") || kinds.has("number") || kinds.has("boolean"))) o["type"] = [...kinds][0];
  }
  if (o["maximum"] === Number.MAX_SAFE_INTEGER) delete o["maximum"];
  if (o["minimum"] === Number.MIN_SAFE_INTEGER) delete o["minimum"];
  for (const v of Object.values(o)) normalise(v);
}
function toJsonSchema7(schema, name) {
  const body = toJSONSchema(schema, { target: "draft-7", io: "input", unrepresentable: "any" });
  normalise(body);
  const { $schema: _drop, ...definition } = body;
  return { $ref: `#/definitions/${name}`, definitions: { [name]: definition }, $schema: "http://json-schema.org/draft-07/schema#" };
}

// src/scripts/_lib/module_detection.ts
import * as fs36 from "node:fs";
import * as path36 from "node:path";
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
function _isDir2(p) {
  try {
    return fs36.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
function _isFile2(p) {
  try {
    return fs36.statSync(p).isFile();
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
    entries = fs36.readdirSync(root).sort();
  } catch {
    return [];
  }
  const out = [];
  for (const name of entries) {
    if (!_isDir2(path36.join(root, name))) {
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
    const withPkgJson = subdirs.filter((name) => _isFile2(path36.join(root, name, "package.json")));
    return withPkgJson.length > 0 ? "high" : "medium";
  }
  if (stack === "python-src") {
    const withInit = subdirs.filter((name) => _isFile2(path36.join(root, name, "__init__.py")));
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
    const abs_path = path36.join(project_root, rel_path);
    if (!_isDir2(abs_path)) {
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
import fs37 from "node:fs";
var TIER_TO_CLAUDE_MODEL = {
  frontier: "fable",
  high: "opus",
  medium: "sonnet",
  lite: "haiku"
};
var MODEL_TIER_RE = /^model_tier:\s*"?([a-z]+)"?\s*$/m;
function read_model_tier(skill_md) {
  if (!fs37.existsSync(skill_md)) return null;
  const text = fs37.readFileSync(skill_md).toString("utf-8");
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
import { spawnSync as spawnSync2 } from "node:child_process";
import * as fs38 from "node:fs";
import * as path37 from "node:path";
import process3 from "node:process";
import { fileURLToPath as fileURLToPath7, pathToFileURL } from "node:url";
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
var _HERE_DIR = path37.dirname(fileURLToPath7(import.meta.url));
var ArgparseExit = class extends Error {
  code;
  constructor(code) {
    super(`ArgparseExit(${code})`);
    this.name = "ArgparseExit";
    this.code = code;
  }
};
function _stdoutSink() {
  return { write: (t) => process3.stdout.write(t) };
}
function _stderrSink() {
  return { write: (t) => process3.stderr.write(t) };
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
function _isFile3(p) {
  try {
    return fs38.statSync(p).isFile();
  } catch {
    return false;
  }
}
function _isDir3(p) {
  try {
    return fs38.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
function _isSymlink(p) {
  try {
    return fs38.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}
function _exists2(p) {
  try {
    fs38.lstatSync(p);
    return true;
  } catch {
    return false;
  }
}
function _readText(p) {
  return fs38.readFileSync(p, { encoding: "utf-8" });
}
function _writeText(p, text) {
  fs38.writeFileSync(p, text, { encoding: "utf-8" });
}
function _jsonLoadFile(p) {
  return JSON.parse(_readText(p));
}
function _isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function _detect_npm(pkg_json) {
  if (!_isFile3(pkg_json)) {
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
  if (!_isFile3(composer_json)) {
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
    target = fs38.readlinkSync(link);
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
  return _isFile3(path37.join(project, LEGACY_STATE_FILENAME));
}
function _detect_legacy_settings(project) {
  const found = [];
  for (const name of LEGACY_SETTINGS_FILES) {
    const flat = path37.join(project, name);
    if (_isFile3(flat)) {
      found.push(flat);
    }
    const typed = path37.join(project, "settings", name);
    if (_isFile3(typed)) {
      found.push(typed);
    }
  }
  return found;
}
function _detect_empty_shell(project) {
  const shell = path37.join(project, LEGACY_AGENT_CONFIG_SHELL);
  if (!_isDir3(shell) || _isSymlink(shell)) {
    return false;
  }
  try {
    return fs38.readdirSync(shell).length === 0;
  } catch {
    return false;
  }
}
function _detect_already_migrated(project) {
  if (_detect_npm(path37.join(project, "package.json"))) {
    return false;
  }
  if (_detect_composer(path37.join(project, "composer.json"))) {
    return false;
  }
  for (const name of MANAGED_SYMLINKS) {
    if (_classify_symlink(path37.join(project, name)) === "legacy") {
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
    const link = path37.join(project, name);
    const kind = _classify_symlink(link);
    if (kind === "legacy") {
      try {
        fs38.unlinkSync(link);
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
  const source = path37.join(project, LEGACY_STATE_FILENAME);
  if (!_isFile3(source)) {
    return null;
  }
  const target = path37.join(project, LEGACY_STATE_V1_FILENAME);
  if (_exists2(target)) {
    try {
      fs38.unlinkSync(source);
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
  const rel = path37.join(
    "agent-src",
    "templates",
    "scripts",
    "work_engine",
    "migration",
    "v0_to_v1.ts"
  );
  const driver = [path37.join(pkg_root, "dist", rel), path37.join(pkg_root, "src", rel)].find(
    (p) => fs38.existsSync(p)
  ) ?? null;
  if (driver === null) {
    return null;
  }
  const binName = process3.platform === "win32" ? "tsx.cmd" : "tsx";
  let tsxBin = null;
  for (let dir = pkg_root; ; ) {
    const cand = path37.join(dir, "node_modules", ".bin", binName);
    if (fs38.existsSync(cand)) {
      tsxBin = cand;
      break;
    }
    const parent = path37.dirname(dir);
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
    const r = spawnSync2(command, args, { encoding: "utf8" });
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
      fs38.unlinkSync(p);
      removed.push(path37.relative(project, p));
    } catch {
      continue;
    }
  }
  const settings_dir = path37.join(project, "settings");
  if (_isDir3(settings_dir) && !_isSymlink(settings_dir)) {
    try {
      if (fs38.readdirSync(settings_dir).length === 0) {
        fs38.rmdirSync(settings_dir);
        removed.push("settings/");
      }
    } catch {
    }
  }
  return removed;
}
function _remove_empty_shell(project) {
  const shell = path37.join(project, LEGACY_AGENT_CONFIG_SHELL);
  if (!_detect_empty_shell(project)) {
    return false;
  }
  try {
    fs38.rmdirSync(shell);
  } catch {
    return false;
  }
  return true;
}
function _reEscape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function _update_gitignore(project) {
  const gitignore = path37.join(project, ".gitignore");
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
    npm: _detect_npm(path37.join(project, "package.json")),
    composer: _detect_composer(path37.join(project, "composer.json")),
    symlinks_legacy: MANAGED_SYMLINKS.filter(
      (name) => _classify_symlink(path37.join(project, name)) === "legacy"
    ),
    symlinks_user: MANAGED_SYMLINKS.filter(
      (name) => _classify_symlink(path37.join(project, name)) === "user"
    ),
    state_file: _isFile3(path37.join(project, LEGACY_STATE_FILENAME)),
    settings_files: _detect_legacy_settings(project).map((p) => path37.relative(project, p)),
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
  if (_strip_npm_entry(path37.join(project, "package.json"))) {
    summary.push(`removed ${PACKAGE_NAME_NPM} from package.json`);
  }
  if (_strip_composer_entry(path37.join(project, "composer.json"))) {
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
function _parse4(argv, out, err) {
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
  const args = _parse4(argv ?? process3.argv.slice(2), out, err);
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
var _HERE3 = fileURLToPath7(import.meta.url);
function _isCliEntry() {
  if (process3.argv[1] === void 0) {
    return false;
  }
  if (typeof __AGENT_CONFIG_CLI_DELEGATE__ !== "undefined" && __AGENT_CONFIG_CLI_DELEGATE__) {
    if (path37.basename(process3.argv[1], ".js") === "cmd_migrate") {
      return true;
    }
  }
  const argvUrl = pathToFileURL(path37.resolve(process3.argv[1])).href;
  if (import.meta.url === argvUrl) {
    return true;
  }
  try {
    const here = fs38.realpathSync(fileURLToPath7(import.meta.url));
    const argv = fs38.realpathSync(path37.resolve(process3.argv[1]));
    return here === argv;
  } catch {
    return false;
  }
}
if (!_inForeignBundle && (_isCliEntry() || process3.argv[1] === _HERE3)) {
  try {
    process3.exitCode = main(process3.argv.slice(2));
  } catch (exc) {
    if (exc instanceof ArgparseExit) {
      process3.exitCode = exc.code;
    } else {
      throw exc;
    }
  }
}

// src/install/detect.ts
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

// src/install/txlog.ts
import { createGzip } from "node:zlib";
import { createReadStream, createWriteStream, existsSync as existsSync18, readFileSync as readFileSync36, renameSync as renameSync8, statSync as statSync14, unlinkSync as unlinkSync8 } from "node:fs";
import { pipeline } from "node:stream/promises";
var ROTATION_MAX_BYTES = 10 * 1024 * 1024;
var ROTATION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1e3;
function appendTxLog(logPath, entry) {
  if (shouldRotate(logPath)) {
    rotateLogSync(logPath);
  }
  atomicAppendLine(logPath, JSON.stringify(entry));
}
function shouldRotate(logPath, now = /* @__PURE__ */ new Date()) {
  if (!existsSync18(logPath)) {
    return false;
  }
  let size = 0;
  try {
    size = statSync14(logPath).size;
  } catch {
    return false;
  }
  if (size >= ROTATION_MAX_BYTES) {
    return true;
  }
  const firstTs = readFirstTimestamp(logPath);
  if (firstTs === null) {
    return false;
  }
  return now.getTime() - firstTs >= ROTATION_MAX_AGE_MS;
}
function rotateLogSync(logPath) {
  if (!existsSync18(logPath)) {
    return;
  }
  const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
  const rotated = logPath.replace(/\.jsonl$/, `.${stamp}.jsonl`);
  renameSync8(logPath, rotated);
  void gzipInPlace(rotated).catch(() => {
  });
}
async function gzipInPlace(source) {
  const target = `${source}.gz`;
  await pipeline(createReadStream(source), createGzip(), createWriteStream(target));
  try {
    unlinkSync8(source);
  } catch {
  }
}
function readFirstTimestamp(logPath) {
  try {
    const raw = readFileSync36(logPath, "utf8");
    const firstLine = raw.split("\n", 1)[0] ?? "";
    const parsed = tryParseEntry(firstLine);
    if (parsed === null) return null;
    const t = Date.parse(parsed.ts);
    return Number.isFinite(t) ? t : null;
  } catch {
    return null;
  }
}
function tryParseEntry(line) {
  try {
    const obj = JSON.parse(line);
    if (typeof obj.ts !== "string" || typeof obj.kind !== "string" || typeof obj.path !== "string") {
      return null;
    }
    return obj;
  } catch {
    return null;
  }
}

// src/scripts/install.ts
var _HERE4 = fileURLToPath8(import.meta.url);
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
function expanduser8(p) {
  if (p === "~") return os14.homedir();
  if (p.startsWith("~/") || p.startsWith("~\\")) {
    return path38.join(os14.homedir(), p.slice(2));
  }
  return p;
}
function isFile(p) {
  try {
    return fs39.statSync(p).isFile();
  } catch {
    return false;
  }
}
function isDir(p) {
  try {
    return fs39.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
function isSymlink(p) {
  try {
    return fs39.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}
function readText(p) {
  return fs39.readFileSync(p, "utf-8");
}
function writeText(p, content) {
  fs39.writeFileSync(p, content, "utf-8");
}
function sortedGlobStems(directory, suffix) {
  let entries;
  try {
    entries = fs39.readdirSync(directory);
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
  for (const name of fs39.readdirSync(directory)) {
    if (name.endsWith(".zip")) n += 1;
  }
  return n;
}
function atomicWrite0644(target, body, prefix) {
  const dir = path38.dirname(target);
  const tmpName = path38.join(
    dir,
    `${prefix}${process4.pid}.${crypto5.randomBytes(6).toString("hex")}.yml.tmp`
  );
  let fd = null;
  try {
    fd = fs39.openSync(tmpName, "wx", 420);
    fs39.writeFileSync(fd, body, "utf-8");
    fs39.closeSync(fd);
    fd = null;
    fs39.chmodSync(tmpName, 420);
    fs39.renameSync(tmpName, target);
  } catch (err) {
    if (fd !== null) {
      try {
        fs39.closeSync(fd);
      } catch {
      }
    }
    try {
      fs39.unlinkSync(tmpName);
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
function yamlSafeLoad2(text) {
  let YAML6;
  try {
    YAML6 = require_dist();
  } catch {
    return null;
  }
  try {
    const data = YAML6.parse(text, { version: "1.1" });
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
  return path38.join(project_root, ...SETTINGS_SUBDIR, SETTINGS_FILE);
}
function _resolve_settings_read(project_root) {
  const canonical = _canonical_settings_target(project_root);
  if (pathExists(canonical)) return canonical;
  const legacy = path38.join(project_root, SETTINGS_FILE);
  if (pathExists(legacy)) return legacy;
  return canonical;
}
var LEGACY_RENAME_MAP = {
  cost_profile: "rule_loading_tier",
  ide: "personal.ide",
  open_edited_files: "personal.open_edited_files",
  user_name: "personal.user_name",
  rtk_installed: "personal.rtk_installed",
  upstream_repo: "project.upstream_repo",
  improvement_pr_branch_prefix: "project.improvement_pr_branch_prefix",
  github_pr_reply_method: "github.pr_reply_method",
  eloquent_access_style: "eloquent.access_style",
  subagent_implementer_model: "subagents.implementer_model",
  subagent_judge_model: "subagents.judge_model",
  subagent_max_parallel: "subagents.max_parallel"
};
var state = {
  QUIET: false,
  PROGRESS_NDJSON: false,
  FULL_PIN: false
};
function _emit_progress(obj) {
  if (!state.PROGRESS_NDJSON) return;
  process4.stdout.write(jsonDumpsCompact(obj) + "\n");
}
function _emit_progress_terminal(rc) {
  if (!state.PROGRESS_NDJSON) return;
  if (rc === 0) {
    _emit_progress({ type: "done" });
  } else if (rc === EXIT_COMPLETED_WITH_CONFLICTS) {
    _emit_progress({ type: "done", conflicts: tracker.conflictState.preserved.length });
  } else {
    _emit_progress({ type: "error", code: "E_INSTALL", exitCode: rc });
  }
}
function info(msg) {
  if (!state.QUIET) process4.stdout.write(`  ${msg}
`);
}
function success(msg) {
  if (!state.QUIET) process4.stdout.write(`  \u2705  ${msg}
`);
}
function skip(msg) {
  if (!state.QUIET) process4.stdout.write(`  \u23ED\uFE0F  ${msg}
`);
}
function warn(msg) {
  process4.stderr.write(`  \u26A0\uFE0F  ${msg}
`);
}
function fail(msg) {
  process4.stderr.write(`  \u274C  ${msg}
`);
  process4.stderr.write(
    "      Diagnose: `./agent-config doctor` (or `--check <id>` for a single category)\n"
  );
  throw new SystemExitError(1);
}
function detect_package_root(project_root) {
  const npm_path = path38.join(project_root, "node_modules", "@event4u", "agent-config");
  if (isDir(npm_path)) return resolvePath(npm_path);
  if (pathExists(path38.join(project_root, "src", "config", "profiles", "minimal.ini"))) {
    return project_root;
  }
  fail(
    "Could not find agent-config package. Install via `npx @event4u/agent-config init` or `npm install -g @event4u/agent-config`."
  );
}
function detect_package_type(package_root) {
  if (package_root.split(path38.sep).includes("node_modules")) return "npm";
  return "local";
}
function detect_package_type_for_project(project_root, package_root) {
  const npm_path = resolvePath(
    path38.join(project_root, "node_modules", "@event4u", "agent-config")
  );
  const package_resolved = resolvePath(package_root);
  if (package_resolved === npm_path) return "npm";
  return detect_package_type(package_root);
}
function _is_interactive() {
  try {
    return Boolean(process4.stdin.isTTY) && Boolean(process4.stdout.isTTY);
  } catch {
    return false;
  }
}
var tracker = createConflictTracker({
  warn,
  fail,
  logWrite: (target) => _log_tx_entry("write", target),
  emitProgress: (frame) => _emit_progress(frame),
  tagDeployed: (target, source, package_root) => _inject_package_tag(target, source, package_root)
});
function ensure_directory(p) {
  mkdirp(p);
}
function write_file(p, content) {
  ensure_directory(path38.dirname(p));
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
function merge_json_file(p, new_data, _force, label) {
  const new_entries = build_merge_entries(label, new_data);
  if (!pathExists(p)) {
    write_json_file(p, new_data);
    success(`${label} created`);
    return new_entries;
  }
  const existing = read_json_file(p);
  const merged = mergeHostConfig(existing, new_data, HOOK_SIGNATURES[label] ?? "", deepMerge);
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
  const unknown2 = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (!line.includes("=")) continue;
    const eq = line.indexOf("=");
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!key) continue;
    values[key] = value;
    if (!(key in LEGACY_RENAME_MAP)) unknown2.push(key);
  }
  return [values, unknown2];
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
  const legacy_target = path38.join(project_root, LEGACY_SETTINGS_FILE);
  if (!isFile(legacy_target)) return null;
  const legacy_text = readText(legacy_target);
  const [values, unknown2] = _parse_legacy_settings(legacy_text);
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
  rendered = _append_unknown_legacy(rendered, values, unknown2);
  const backup_target = path38.join(project_root, LEGACY_BACKUP_FILE);
  writeText(backup_target, legacy_text);
  fs39.unlinkSync(legacy_target);
  info(`Migrated legacy ${LEGACY_SETTINGS_FILE} \u2192 ${SETTINGS_FILE}`);
  info(`Backup saved to ${LEGACY_BACKUP_FILE}`);
  if (unknown2.length > 0) {
    warn(`Legacy keys not in rename map preserved under _legacy: ${[...unknown2].sort().join(", ")}`);
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
  const directory = path38.join(package_root, USER_TYPES_DIR);
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
  const profile_source = path38.join(package_root, "src", "config", "profiles", `${profile}.ini`);
  const template_source = path38.join(package_root, "src", "config", "agent-settings.template.yml");
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
      `Profile preset ${path38.basename(profile_source)} has rule_loading_tier=${got} but --profile=${profile}`
    );
  }
  profile_values["user_type"] = _validate_user_type(package_root, user_type);
  let template_body = _render_template(template, profile_values);
  template_body = _inject_packs(template_body, packs ?? []);
  const legacy_root = path38.join(project_root, SETTINGS_FILE);
  if (isFile(legacy_root) && !pathExists(target)) {
    mkdirp(path38.dirname(target));
    writeText(target, readText(legacy_root));
    fs39.unlinkSync(legacy_root);
    success(`Migrated ${SETTINGS_FILE} \u2192 agents/settings/${SETTINGS_FILE} (ADR-038)`);
    return;
  }
  const legacy_target = path38.join(project_root, LEGACY_SETTINGS_FILE);
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
  mkdirp(path38.dirname(target));
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
    path38.join(project_root, ".vscode", "settings.json"),
    bridge,
    force,
    ".vscode/settings.json"
  );
}
function ensure_augment_bridge(project_root, force) {
  const bridge = { enabledPlugins: { "agent-config@event4u": true } };
  return merge_json_file(
    path38.join(project_root, ".augment", "settings.json"),
    bridge,
    force,
    ".augment/settings.json"
  );
}
var AUGMENT_USER_DIR = path38.join(os14.homedir(), ".augment");
var AUGMENT_USER_HOOKS_DIR = path38.join(AUGMENT_USER_DIR, "hooks");
var AUGMENT_DISPATCHER_TRAMPOLINE = "augment-dispatcher.sh";
var AUGMENT_LEGACY_TRAMPOLINES = [
  "augment-chat-history.sh",
  "augment-roadmap-progress.sh",
  "augment-onboarding-gate.sh",
  "augment-context-hygiene.sh"
];
function _deploy_augment_trampoline(package_root, name, force) {
  const src = path38.join(package_root, "scripts", "hooks", name);
  if (!pathExists(src)) {
    skip(`augment trampoline missing in package: ${src}`);
    return null;
  }
  mkdirp(AUGMENT_USER_HOOKS_DIR);
  const dst = path38.join(AUGMENT_USER_HOOKS_DIR, name);
  const src_text = readText(src);
  if (pathExists(dst) && readText(dst) === src_text && !force) {
    skip(`~/.augment/hooks/${name} already up to date`);
  } else {
    writeText(dst, src_text);
    fs39.chmodSync(dst, 493);
    success(`~/.augment/hooks/${name} installed`);
  }
  return dst;
}
function _remove_legacy_augment_trampolines() {
  for (const name of AUGMENT_LEGACY_TRAMPOLINES) {
    const legacy = path38.join(AUGMENT_USER_HOOKS_DIR, name);
    try {
      if (isFile(legacy)) {
        fs39.unlinkSync(legacy);
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
  for (const { slot, native } of hostBindings("augment")) {
    const cmd = `${dst} ${slot} ${native}`;
    const entry = { hooks: [{ type: "command", command: cmd }] };
    (per_event[native] ??= []).push(entry);
  }
  const settings_patch = { hooks: per_event };
  return merge_json_file(
    path38.join(AUGMENT_USER_DIR, "settings.json"),
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
  if (!isPlainObject(enabled)) return [];
  const removed = CLAUDE_LEGACY_PLUGIN_IDS.filter((pid) => pid in enabled);
  if (removed.length === 0) return [];
  for (const pid of removed) {
    delete enabled[pid];
  }
  write_json_file(p, data);
  return removed;
}
function ensure_claude_bridge(project_root, force) {
  const target = path38.join(project_root, ".claude", "settings.json");
  const healed = _heal_legacy_claude_plugin_ids(target);
  for (const pid of healed) success(`.claude/settings.json: removed stale plugin id \`${pid}\``);
  const bridge = withHostEnv({ enabledPlugins: { [CLAUDE_PLUGIN_ID]: true } }, project_root, success);
  return merge_json_file(target, bridge, force || healed.length > 0, ".claude/settings.json");
}
var ensure_mcp_bridge = makeEnsureMcpBridge(merge_json_file);
var _tier_b_advisory = tierBAdvisory;
function _cursor_dispatch_command(ac_event, native) {
  return `[ -x ./agent-config ] || exit 0; ./agent-config dispatch:hook --platform cursor --event ${ac_event} --native-event ${native}`;
}
function ensure_cursor_bridge(project_root, force) {
  const hooks = {};
  for (const { slot, native } of hostBindings("cursor")) {
    (hooks[native] ??= []).push({ command: _cursor_dispatch_command(slot, native) });
  }
  const bridge = { version: 1, hooks };
  return merge_json_file(
    path38.join(project_root, ".cursor", "hooks.json"),
    bridge,
    force,
    ".cursor/hooks.json"
  );
}
var CURSOR_USER_DIR = path38.join(os14.homedir(), ".cursor");
var CURSOR_USER_HOOKS_DIR = path38.join(CURSOR_USER_DIR, "hooks");
var CURSOR_DISPATCHER_TRAMPOLINE = "cursor-dispatcher.sh";
function ensure_cursor_user_hooks(package_root, force) {
  const src = path38.join(package_root, "scripts", "hooks", CURSOR_DISPATCHER_TRAMPOLINE);
  if (!pathExists(src)) {
    skip(`cursor trampoline missing in package: ${src}`);
    return [];
  }
  mkdirp(CURSOR_USER_HOOKS_DIR);
  const dst = path38.join(CURSOR_USER_HOOKS_DIR, CURSOR_DISPATCHER_TRAMPOLINE);
  const src_text = readText(src);
  if (pathExists(dst) && readText(dst) === src_text && !force) {
    skip(`~/.cursor/hooks/${CURSOR_DISPATCHER_TRAMPOLINE} already up to date`);
  } else {
    writeText(dst, src_text);
    fs39.chmodSync(dst, 493);
    success(`~/.cursor/hooks/${CURSOR_DISPATCHER_TRAMPOLINE} installed`);
  }
  const hooks = {};
  for (const { slot, native } of hostBindings("cursor")) {
    (hooks[native] ??= []).push({ command: `${dst} ${slot} ${native}` });
  }
  const settings_patch = { version: 1, hooks };
  return merge_json_file(
    path38.join(CURSOR_USER_DIR, "hooks.json"),
    settings_patch,
    force,
    "~/.cursor/hooks.json"
  );
}
function shlexQuote(s) {
  if (s === "") return "''";
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(s)) return s;
  return "'" + s.replace(/'/g, `'"'"'`) + "'";
}
function clineProjectHookBody(native_event, ac_event, workspace_quoted) {
  return `#!/usr/bin/env bash
# Generated by event4u/agent-config \u2014 DO NOT EDIT.
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
  const hooks_dir = path38.join(project_root, ".clinerules", "hooks");
  mkdirp(hooks_dir);
  const workspace_quoted = shlexQuote(resolvePath(project_root));
  let written = 0;
  for (const { slot, native } of hostBindings("cline")) {
    const target = path38.join(hooks_dir, native);
    const body = clineProjectHookBody(native, slot, workspace_quoted);
    if (pathExists(target) && readText(target) === body && !force) {
      continue;
    }
    if (pathExists(target) && !force) {
      skip(`.clinerules/hooks/${native} exists, needs update (use --force)`);
      continue;
    }
    writeText(target, body);
    fs39.chmodSync(target, 493);
    written += 1;
  }
  if (written) {
    success(`.clinerules/hooks/ \u2014 ${written} script(s) installed`);
  } else {
    skip(".clinerules/hooks/ already up to date");
  }
}
var CLINE_USER_DIR = path38.join(os14.homedir(), "Documents", "Cline", "Hooks");
var CLINE_DISPATCHER_TRAMPOLINE = "cline-dispatcher.sh";
function ensure_cline_user_hooks(package_root, force) {
  const src = path38.join(package_root, "scripts", "hooks", CLINE_DISPATCHER_TRAMPOLINE);
  if (!pathExists(src)) {
    skip(`cline trampoline missing in package: ${src}`);
    return;
  }
  mkdirp(CLINE_USER_DIR);
  const trampoline = path38.join(CLINE_USER_DIR, CLINE_DISPATCHER_TRAMPOLINE);
  const src_text = readText(src);
  if (pathExists(trampoline) && readText(trampoline) === src_text && !force) {
    skip(`~/Documents/Cline/Hooks/${CLINE_DISPATCHER_TRAMPOLINE} already up to date`);
  } else {
    writeText(trampoline, src_text);
    fs39.chmodSync(trampoline, 493);
    success(`~/Documents/Cline/Hooks/${CLINE_DISPATCHER_TRAMPOLINE} installed`);
  }
  const trampoline_quoted = shlexQuote(trampoline);
  for (const { slot, native } of hostBindings("cline")) {
    const wrapper = path38.join(CLINE_USER_DIR, native);
    const body = `#!/usr/bin/env bash
# Generated by event4u/agent-config \u2014 DO NOT EDIT.
# User-scope Cline hook for ${native} \u2192 agent-config ${slot}.
exec ${trampoline_quoted} ${slot} ${native}
`;
    if (pathExists(wrapper) && readText(wrapper) === body && !force) {
      continue;
    }
    writeText(wrapper, body);
    fs39.chmodSync(wrapper, 493);
  }
}
function _windsurf_dispatch_command(ac_event, native) {
  return `[ -x ./agent-config ] || exit 0; ./agent-config dispatch:hook --platform windsurf --event ${ac_event} --native-event ${native}`;
}
function ensure_windsurf_bridge(project_root, force) {
  const hooks = {};
  for (const { slot, native } of hostBindings("windsurf")) {
    (hooks[native] ??= []).push({
      command: _windsurf_dispatch_command(slot, native),
      show_output: false
    });
  }
  const bridge = { hooks };
  return merge_json_file(
    path38.join(project_root, ".windsurf", "hooks.json"),
    bridge,
    force,
    ".windsurf/hooks.json"
  );
}
var WINDSURF_USER_DIR = path38.join(os14.homedir(), ".codeium", "windsurf");
var WINDSURF_USER_HOOKS_DIR = path38.join(WINDSURF_USER_DIR, "hooks");
var WINDSURF_DISPATCHER_TRAMPOLINE = "windsurf-dispatcher.sh";
function ensure_windsurf_user_hooks(package_root, force) {
  const src = path38.join(package_root, "scripts", "hooks", WINDSURF_DISPATCHER_TRAMPOLINE);
  if (!pathExists(src)) {
    skip(`windsurf trampoline missing in package: ${src}`);
    return [];
  }
  mkdirp(WINDSURF_USER_HOOKS_DIR);
  const dst = path38.join(WINDSURF_USER_HOOKS_DIR, WINDSURF_DISPATCHER_TRAMPOLINE);
  const src_text = readText(src);
  if (pathExists(dst) && readText(dst) === src_text && !force) {
    skip(`~/.codeium/windsurf/hooks/${WINDSURF_DISPATCHER_TRAMPOLINE} already up to date`);
  } else {
    writeText(dst, src_text);
    fs39.chmodSync(dst, 493);
    success(`~/.codeium/windsurf/hooks/${WINDSURF_DISPATCHER_TRAMPOLINE} installed`);
  }
  const hooks = {};
  for (const { slot, native } of hostBindings("windsurf")) {
    (hooks[native] ??= []).push({
      command: `${dst} ${slot} ${native}`,
      show_output: false
    });
  }
  const settings_patch = { hooks };
  return merge_json_file(
    path38.join(WINDSURF_USER_DIR, "hooks.json"),
    settings_patch,
    force,
    "~/.codeium/windsurf/hooks.json"
  );
}
function _gemini_dispatch_command(ac_event, native) {
  return `[ -x ./agent-config ] || exit 0; ./agent-config dispatch:hook --platform gemini --event ${ac_event} --native-event ${native}`;
}
function _gemini_hooks_dict(command_factory) {
  const out = {};
  for (const { slot, native, matcher } of hostBindings("gemini")) {
    (out[native] ??= []).push({
      matcher,
      hooks: [{ type: "command", command: command_factory(slot, native) }]
    });
  }
  return out;
}
function ensure_gemini_bridge(project_root, force) {
  const bridge = { hooks: _gemini_hooks_dict(_gemini_dispatch_command) };
  return merge_json_file(
    path38.join(project_root, ".gemini", "settings.json"),
    bridge,
    force,
    ".gemini/settings.json"
  );
}
var GEMINI_USER_DIR = path38.join(os14.homedir(), ".gemini");
var GEMINI_USER_HOOKS_DIR = path38.join(GEMINI_USER_DIR, "hooks");
var GEMINI_DISPATCHER_TRAMPOLINE = "gemini-dispatcher.sh";
function ensure_gemini_user_hooks(package_root, force) {
  const src = path38.join(package_root, "scripts", "hooks", GEMINI_DISPATCHER_TRAMPOLINE);
  if (!pathExists(src)) {
    skip(`gemini trampoline missing in package: ${src}`);
    return [];
  }
  mkdirp(GEMINI_USER_HOOKS_DIR);
  const dst = path38.join(GEMINI_USER_HOOKS_DIR, GEMINI_DISPATCHER_TRAMPOLINE);
  const src_text = readText(src);
  if (pathExists(dst) && readText(dst) === src_text && !force) {
    skip(`~/.gemini/hooks/${GEMINI_DISPATCHER_TRAMPOLINE} already up to date`);
  } else {
    writeText(dst, src_text);
    fs39.chmodSync(dst, 493);
    success(`~/.gemini/hooks/${GEMINI_DISPATCHER_TRAMPOLINE} installed`);
  }
  const settings_patch = {
    hooks: _gemini_hooks_dict((ac_event, native) => `${dst} ${ac_event} ${native}`)
  };
  return merge_json_file(
    path38.join(GEMINI_USER_DIR, "settings.json"),
    settings_patch,
    force,
    "~/.gemini/settings.json"
  );
}
function ensure_copilot_bridge(project_root, force) {
  const target = path38.join(project_root, ".github", "plugin", "marketplace.json");
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
  const target = path38.join(project_root, ".roo", "rules", "agent-config.md");
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
  const target = path38.join(project_root, ".claude-desktop", "agent-config.md");
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
  const target = path38.join(project_root, ".aider", "agent-config.md");
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
  const target = path38.join(project_root, ".codex", "agent-config.md");
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
  const target = path38.join(project_root, ".continue", "rules", "agent-config.md");
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
  const target = path38.join(project_root, ".kilocode", "rules", "agent-config.md");
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
  const target = path38.join(project_root, ".zed", "agent-config.md");
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
  const target = path38.join(project_root, ".jetbrains", "agent-config.md");
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
  const target = path38.join(project_root, ".kiro", "steering", "agent-config.md");
  if (pathExists(target) && !force) {
    skip(".kiro/steering/agent-config.md already exists");
    return;
  }
  write_file(target, KIRO_MARKER);
  success(".kiro/steering/agent-config.md created");
}
var SMOKE_PROBE_SLOTS = [
  ["augment", "session_start"],
  ["claude", "session_start"],
  ["cursor", "session_start"],
  ["cline", "session_start"],
  ["windsurf", "session_start"],
  ["gemini", "session_start"]
];
function smokeProbeEvents() {
  return SMOKE_PROBE_SLOTS.map(([platform, slot]) => {
    const binding = hostBindings(platform).find((b) => b.slot === slot);
    if (binding === void 0) {
      throw new Error(
        `install smoke probe: host_lowering.yaml has no \`${slot}\` binding for \`${platform}\``
      );
    }
    return [platform, binding.native];
  });
}
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
    return fs39.readdirSync(p).length > 0;
  } catch {
    return false;
  }
}
function _resolve_tsx_invocation(scriptPath, scriptArgs) {
  const binName = process4.platform === "win32" ? "tsx.cmd" : "tsx";
  let dir = path38.dirname(scriptPath);
  for (; ; ) {
    const candidate = path38.join(dir, "node_modules", ".bin", binName);
    if (isFile(candidate)) {
      return { command: candidate, args: [scriptPath, ...scriptArgs] };
    }
    const parent = path38.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return { command: "npx", args: ["tsx", scriptPath, ...scriptArgs] };
}
function _smoke_test_hooks(project_root, package_root) {
  const dispatcher = path38.join(package_root, "scripts", "hooks", "dispatch_hook.ts");
  const manifest = path38.join(package_root, "scripts", "hook_manifest.yaml");
  if (!isFile(dispatcher) || !isFile(manifest)) return 0;
  const failed = [];
  const skipped = [];
  const passed = [];
  for (const [platform, native] of smokeProbeEvents()) {
    const rel_bridge = SMOKE_BRIDGE_PATHS[platform] ?? "";
    const bridge_path = rel_bridge ? path38.join(project_root, rel_bridge) : null;
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
      res = spawnSync3(inv.command, inv.args, {
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
    const concerns = isPlainObject(plan) ? plan["concerns"] : void 0;
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
var USER_SCOPE_PATHS2 = {
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
function claudeDesktopMarkerBody(lockfile, anchor2, bundles_dir, bundle_count) {
  return `# agent-config \u2014 Claude Desktop marker

Installed by \`@event4u/agent-config\` (user scope, ADR-007).

- Lockfile:    \`${lockfile}\`
- Anchor:      \`${anchor2}\`
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
var GLOBAL_ROOT = path38.join(os14.homedir(), ".event4u", "agent-config");
var GLOBAL_USER_SETTINGS_PATH = path38.join(GLOBAL_ROOT, ".agent-user.yml");
var GLOBAL_AGENT_SETTINGS_PATH = path38.join(GLOBAL_ROOT, ".agent-settings.yml");
function _bridge_marker(tool_id, scope) {
  if (scope === "global") return USER_SCOPE_PATHS2[tool_id] ?? "";
  return PROJECT_BRIDGE_MARKERS[tool_id] ?? "";
}
function _validate_scope(tools, scope, was_all) {
  if (scope !== "project" && scope !== "global") {
    fail(`_validate_scope: unknown scope '${scope}'`);
  }
  if (process4.env["AGENT_CONFIG_DEV_MODE"] === "1") return tools;
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
  if (process4.env["AGENT_CONFIG_DEV_MODE"] === "1") return;
  fail(
    "--scope=project is reserved for maintainers (ADR-020 \u2014 consumer installs are global-only). Set AGENT_CONFIG_DEV_MODE=1 to opt in. See docs/maintainers/dev-mode.md."
  );
}
function _enforce_not_source_repo(scope, project_root) {
  if (scope === "global") return;
  if (process4.env["AGENT_CONFIG_ALLOW_SELF_INSTALL"] === "1") return;
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
  return isPlainObject(data) ? data : {};
}
function _load_default_settings(package_root) {
  const template_source = path38.join(package_root, "src", "config", "agent-settings.template.yml");
  if (!pathExists(template_source)) return {};
  let text;
  try {
    text = readText(template_source);
  } catch {
    return {};
  }
  const rendered = text.split(RULE_LOADING_TIER_PLACEHOLDER).join(DEFAULT_PROFILE).split(USER_TYPE_PLACEHOLDER).join("");
  const data = yamlSafeLoad2(rendered);
  return isPlainObject(data) ? data : {};
}
var RULE_LAYER_CHOICES = ["global", "project", "both-acknowledged"];
function _suppress_rule_layer(project_root, suppress_dir) {
  const target = path38.join(project_root, ".claude", "settings.local.json");
  const existing = pathExists(target) ? read_json_file(target) : {};
  let real_dir = suppress_dir;
  try {
    real_dir = fs39.realpathSync(suppress_dir);
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
  const [global_dir, project_dir] = hostRuleLayerDirs(project_root);
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
  if (!process4.stdin.isTTY && custom_path === null) {
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
    cp = resolvePath(expanduser8(raw));
    opts.custom_path = cp;
  }
  if (!state.QUIET) info(`Custom destination: ${cp}`);
  return "project";
}
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
  const has_manifest = SCOPE_DETECT_MANIFESTS.find((m) => pathExists(path38.join(cwd, m))) ?? null;
  const has_ai_dir = SCOPE_DETECT_AI_DIRS.find((d) => isDir(path38.join(cwd, d))) ?? null;
  const has_ai_file = SCOPE_DETECT_AI_FILES.find((f) => pathExists(path38.join(cwd, f))) ?? null;
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
  process4.stdout.write(promptText);
  const buf = Buffer.alloc(1);
  const bytes = [];
  let sawAny = false;
  for (; ; ) {
    let n;
    try {
      n = fs39.readSync(0, buf, 0, 1, null);
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
  process4.stdout.write("\n");
  info(`Ambiguous install scope: ${reason}.`);
  info("Choose where to install:");
  process4.stdout.write("  1) Project \u2014 install into the current directory\n");
  process4.stdout.write("  2) User    \u2014 install into ~/ (recommended; one install per machine)\n");
  process4.stdout.write("  3) Custom  \u2014 specify an explicit destination path\n");
  process4.stdout.write("\n");
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
function _update_installed_tools_manifest(project_root, tools, scope, force, files_by_tool = null, merged_keys_by_tool = null) {
  const target = manifest_path(project_root);
  const existing = read_manifest(target) ?? {};
  const prior = readRecordedByTool(target, project_root);
  const preserved = preservedIndex(tracker.conflictState.preserved, tracker.conflictState.staged);
  let entries = hydrateRecordedInventories(
    Array.isArray(existing["tools"]) ? [...existing["tools"]] : [],
    prior
  );
  const version2 = current_package_version();
  for (const tool_id of [...tools].sort()) {
    const marker = _bridge_marker(tool_id, scope);
    if (!marker) continue;
    const files = reconcileToolFiles(files_by_tool?.[tool_id], prior.get(tool_id), preserved);
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
  write_manifest(target, version2, dropGlobalScopeFiles(entries, scope === "global" ? tools : /* @__PURE__ */ new Set()));
  if (!state.QUIET) {
    const rel = isRelativeTo(target, project_root) ? path38.relative(project_root, target) : target;
    info(`Manifest updated: ${rel}`);
  }
  return 0;
}
function isRelativeTo(child, parent) {
  const rel = path38.relative(parent, child);
  return rel === "" || !rel.startsWith("..") && !path38.isAbsolute(rel);
}
function _resolve_package_root_for_global() {
  const here = resolvePath(_HERE4);
  const candidate = path38.dirname(path38.dirname(path38.dirname(here)));
  if (!pathExists(path38.join(candidate, "src", "config", "profiles", "minimal.ini"))) {
    fail(
      `Could not locate agent-config package root from ${here}. Expected src/config/profiles/minimal.ini at the parent directory.`
    );
  }
  return candidate;
}
var CONSUMER_BRIDGE_MARKER_RELPATH = path38.join("agents", ".event4u-bridge.yml");
var MIGRATE_LEGACY_YAML_FILES = [".agent-settings.yml", ".agent-user.yml"];
var MIGRATE_LEGACY_TOOL_DIRS = [".augment", ".claude", ".cursor"];
var AGENT_CONFIG_PACKAGE_NAME = "@event4u/agent-config";
function _is_agent_config_source_repo(project_root) {
  if (process4.env["AGENT_CONFIG_CONSUMER_MODE"] === "1") {
    return [false, "consumer-mode-override"];
  }
  const pkg_json = path38.join(project_root, "package.json");
  if (isFile(pkg_json)) {
    let data = {};
    try {
      data = JSON.parse(readText(pkg_json));
    } catch {
      data = {};
    }
    if (isPlainObject(data) && data["name"] === AGENT_CONFIG_PACKAGE_NAME) {
      return [true, "package.json:name"];
    }
  }
  if (isDir(path38.join(project_root, ".agent-src.uncondensed"))) {
    return [true, ".agent-src.uncondensed/"];
  }
  const packages_dir = path38.join(project_root, "packages");
  if (isDir(packages_dir)) {
    for (const child of fs39.readdirSync(packages_dir)) {
      if (isDir(path38.join(packages_dir, child, ".agent-src.uncondensed"))) {
        return [true, `packages/${child}/.agent-src.uncondensed/`];
      }
    }
  }
  return [false, ""];
}
function _detect_legacy_for_migration(project_root) {
  if (process4.env["AGENT_CONFIG_DEV_MODE"] === "1") return [];
  const [is_source, signature] = _is_agent_config_source_repo(project_root);
  if (is_source) {
    if (!state.QUIET) {
      warn(
        `Maintainer mode auto-detected \u2014 agent-config source repo (signature: ${signature}). Skipping ADR-020 migration prompt; the working tree stays intact. Set AGENT_CONFIG_CONSUMER_MODE=1 to override for end-to-end consumer-flow testing.`
      );
    }
    return [];
  }
  if (isFile(path38.join(project_root, INSTALL_MODE_MARKER_REL))) return [];
  const found = [];
  for (const name of MIGRATE_LEGACY_YAML_FILES) {
    if (isFile(path38.join(project_root, name))) {
      found.push(name);
    } else if (isFile(path38.join(project_root, "settings", name))) {
      found.push(`settings/${name}`);
    }
  }
  for (const name of MIGRATE_LEGACY_TOOL_DIRS) {
    const p = path38.join(project_root, name);
    if (isDir(p) && !isSymlink(p)) {
      found.push(`${name}/`);
    }
  }
  return found.sort();
}
function _prompt_migrate_to_global(project_root, artefacts) {
  if (!state.QUIET) {
    process4.stdout.write("\n");
    warn("Legacy project-local artefacts detected \u2014 pre-ADR-020 layout:");
    for (const rel of artefacts) {
      info(`  ${path38.join(project_root, rel)}`);
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
  const home = resolvePath(os14.homedir());
  const resolved = resolvePath(global_root);
  const rel = path38.relative(home, resolved);
  if (rel === "" || rel.startsWith("..") || path38.isAbsolute(rel)) {
    return global_root;
  }
  return `~/${rel.split(path38.sep).join("/")}`;
}
function _remove_legacy_consumer_bridge_marker(project_root, env = null) {
  const env_map = env ?? process4.env;
  if (env_map["AGENT_CONFIG_DEV_MODE"] === "1") return null;
  if (isDir(path38.join(project_root, ".agent-src.uncondensed"))) return null;
  const target = path38.join(project_root, CONSUMER_BRIDGE_MARKER_RELPATH);
  if (!isFile(target)) return null;
  try {
    fs39.rmSync(target);
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
  const env_map = env ?? process4.env;
  if (env_map["AGENT_CONFIG_DEV_MODE"] === "1") return [];
  if (isDir(path38.join(project_root, ".agent-src.uncondensed"))) return [];
  const global_root_str = _format_global_root_for_marker(
    event4u_root(env_map)
  );
  const stamp = utcStamp(now ?? void 0);
  const written = [];
  for (const tool_id of Object.keys(PROJECT_ANCHOR_TOOLS).sort()) {
    const rel_path = PROJECT_ANCHOR_TOOLS[tool_id];
    if (!tools.has(tool_id)) continue;
    const target = path38.join(project_root, rel_path);
    mkdirp(path38.dirname(target));
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
  if (path38.extname(target) !== ".md") return;
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
      const rel = path38.relative(resolvePath(package_root), resolved_src);
      if (rel !== "" && !rel.startsWith("..") && !path38.isAbsolute(rel)) {
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
    root = fs39.realpathSync(package_root);
  } catch {
    return false;
  }
  return !is_ancestor(root, resolved);
}
function _log_tx_entry(kind, target) {
  try {
    appendTxLog(getLogPath(), {
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      kind,
      path: target,
      sha256: kind === "write" ? sha256OfFile(target) : null
    });
  } catch {
  }
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
      resolved_src = fs39.realpathSync(src);
    } catch {
      resolved_src = src;
    }
    if (_escapes_package_root(resolved_src, package_root)) {
      warn(`refused: ${src} dereferences outside the package root \u2014 not copied`);
      return [0, 0, written_paths];
    }
    mkdirp(path38.dirname(dest));
    const decision = tracker.resolve(dest, force, { from: resolved_src, packageRoot: package_root });
    if (decision === "preserve") {
      tracker.preserve(dest, resolved_src, package_root);
      _log_tx_entry("skip", dest);
      return [0, 1, written_paths];
    }
    fs39.copyFileSync(src, dest);
    _inject_package_tag(dest, src, package_root);
    _log_tx_entry("write", dest);
    written_paths.push(dest);
    return [1, 0, written_paths];
  }
  mkdirp(dest);
  const walk = (node2) => {
    const acc = [];
    const names = fs39.readdirSync(node2).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
    for (const name of names) {
      const entry = path38.join(node2, name);
      acc.push(entry);
      const lst = fs39.lstatSync(entry);
      if (lst.isDirectory() && !lst.isSymbolicLink()) {
        acc.push(...walk(entry));
      }
    }
    return acc;
  };
  for (const entry of walk(src)) {
    const rel = path38.relative(src, entry);
    const target = path38.join(dest, rel);
    const lst = fs39.lstatSync(entry);
    if (lst.isDirectory() && !lst.isSymbolicLink()) {
      mkdirp(target);
      continue;
    }
    let resolvedIsDir = false;
    let resolved = entry;
    try {
      resolved = fs39.realpathSync(entry);
      resolvedIsDir = fs39.statSync(entry).isDirectory();
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
    const decision = tracker.resolve(target, force, { from: resolved, packageRoot: package_root });
    if (decision === "preserve") {
      tracker.preserve(target, resolved, package_root);
      skipped += 1;
      _log_tx_entry("skip", target);
      continue;
    }
    mkdirp(path38.dirname(target));
    fs39.copyFileSync(resolved, target);
    _inject_package_tag(target, resolved, package_root);
    _log_tx_entry("write", target);
    written += 1;
    written_paths.push(target);
  }
  return [written, skipped, written_paths];
}
function _claude_desktop_bundles_dir() {
  return write_target(_CLAUDE_DESKTOP_BUNDLES_SUBPATH);
}
function _write_claude_desktop_marker(force, lockfile_path2, bundles_dir, bundle_count) {
  const anchor2 = expanduser8(USER_SCOPE_PATHS2["claude-desktop"]);
  const target = path38.join(anchor2, "agent-config.md");
  mkdirp(anchor2);
  const body = claudeDesktopMarkerBody(lockfile_path2, anchor2, bundles_dir, bundle_count);
  if (tracker.resolve(target, force, { content: body }) === "preserve") {
    tracker.preserveContent(target, body);
    return [0, 1, []];
  }
  writeText(target, body);
  _log_tx_entry("write", target);
  return [1, 0, [target]];
}
function _deploy_claude_desktop(force, package_root, lockfile_path2) {
  const bundles_dir = _claude_desktop_bundles_dir();
  build_skill_bundles(package_root, bundles_dir, force);
  build_command_bundles(package_root, bundles_dir, force);
  const bundle_count = countZips(bundles_dir);
  const [, , marker_paths] = _write_claude_desktop_marker(force, lockfile_path2, bundles_dir, bundle_count);
  recordGlobalDeploy({ toolId: "claude-desktop", anchorRaw: USER_SCOPE_PATHS2["claude-desktop"], anchor: expanduser8(USER_SCOPE_PATHS2["claude-desktop"]), currentFiles: /* @__PURE__ */ new Set(["agent-config.md"]), destSubs: [], packageTag: PACKAGE_TAG_ID, preserved: tracker.conflictState.preserved, staged: tracker.conflictState.staged, recordedFor: tracker.recordedDigest });
  return [bundle_count, 0, "deployed", [bundles_dir, ...marker_paths]];
}
var _CLAUDE_FLAT_WRAPPER_EXTRA = /* @__PURE__ */ new Set(["commit"]);
function _apply_claude_flat_command_wrappers(anchor2, package_root, current_files, recorded_files = /* @__PURE__ */ new Set()) {
  const wrapped = [];
  const collisions = [];
  const commands_dir = path38.join(anchor2, "commands");
  const { reserved, foreign } = sweepReservedNames(commands_dir, current_files, is_claude_builtin_name, recorded_files);
  const eligible = new Set(_CLAUDE_FLAT_WRAPPER_EXTRA);
  try {
    const manifest = JSON.parse(
      fs39.readFileSync(path38.join(package_root, "dist", "discovery", "discovery-manifest.json"), "utf8")
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
    const flat_abs = path38.join(anchor2, "commands", `${slug}.md`);
    if (!fs39.existsSync(flat_abs)) continue;
    const skill_dir = path38.join(anchor2, "skills", slug);
    if (fs39.existsSync(skill_dir)) {
      collisions.push(slug);
      continue;
    }
    let body = fs39.readFileSync(flat_abs, "utf8");
    if (body.startsWith("---\n") && !/^name:/m.test(body.split("\n---")[0] ?? "")) {
      body = body.replace("---\n", `---
name: ${slug}
`);
    }
    fs39.mkdirSync(skill_dir, { recursive: true });
    fs39.writeFileSync(path38.join(skill_dir, "SKILL.md"), body, "utf8");
    fs39.rmSync(flat_abs, { force: true });
    current_files.delete(flat_rel);
    current_files.add(`skills/${slug}/SKILL.md`);
    wrapped.push(slug);
  }
  return { wrapped, collisions, reserved, foreign };
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
    const anchor_raw = USER_SCOPE_PATHS2[tool_id];
    if (!anchor_raw) {
      results[tool_id] = [0, 0, "unsupported", []];
      continue;
    }
    const anchor2 = expanduser8(anchor_raw);
    let written_total = 0;
    let skipped_total = 0;
    const written_paths = [];
    let current_files = /* @__PURE__ */ new Set();
    for (const [src_rel, dest_sub] of plan) {
      const src = path38.join(package_root, src_rel);
      const dest = dest_sub ? path38.join(anchor2, dest_sub) : anchor2;
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
      const res = _apply_claude_flat_command_wrappers(anchor2, package_root, current_files, recorded_rel_files(tool_id, anchor2));
      const preserved_now = new Set(
        tracker.conflictState.preserved.map((p) => path38.resolve(p))
      );
      rewriteAndReport(
        path38.join(anchor2, "rules"),
        state.QUIET,
        info,
        warn,
        res,
        preserved_now,
        onlyDeployed(anchor2, current_files, (p) => _log_tx_entry("write", p))
      );
      deployClaudeCarrier({
        packageRoot: package_root,
        rulesDir: path38.join(anchor2, "rules"),
        quiet: state.QUIET,
        info,
        warn,
        userPin: state.FULL_PIN,
        wantsThin: installerThinsHost(tool_id, { packageRoot: package_root }),
        thin: (bodyLinkRoot) => describeThinInstalledLayer(thinInstalledRuleLayer({ rulesDir: path38.join(anchor2, "rules"), packageRoot: package_root, preserved: preserved_now, bodyLinkRoot, onWrite: onlyDeployed(anchor2, current_files, (p) => _log_tx_entry("write", p)) }))
      });
      if (!state.QUIET) for (const l of installReceiptBudgetLines(package_root, void 0, { thisDeploy: /* @__PURE__ */ new Map([[anchor2, current_files]]) })) info(l);
    }
    const missing_targets = _verify_deploy_targets(anchor2, plan);
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
    const { reaped, retained } = recordGlobalDeploy({
      toolId: tool_id,
      anchorRaw: anchor_raw,
      anchor: anchor2,
      currentFiles: current_files,
      destSubs: plan.map(([, dest_sub]) => dest_sub),
      packageTag: PACKAGE_TAG_ID,
      preserved: tracker.conflictState.preserved,
      staged: tracker.conflictState.staged,
      recordedFor: tracker.recordedDigest
    });
    for (const p of retained) warn(retainedFileMessage(p));
    if (reaped.length > 0 && !state.QUIET) {
      info(
        `  ${tool_id}: reaped ${reaped.length} stale deployed file(s) from a previous install`
      );
    }
    _emit_progress({ type: "reaped", tool: tool_id, count: reaped.length });
    results[tool_id] = [written_total, skipped_total, "deployed", written_paths];
    if (tool_id === "claude-code") {
      try {
        const manifest = path38.join(package_root, "src", "scripts", "hook_manifest.yaml");
        const matrix = build_claude_hook_matrix(manifest);
        const res = ensure_managed_hooks(
          path38.join(anchor2, "settings.json"),
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
    const anchor_raw = USER_SCOPE_PATHS2[tool_id];
    if (!anchor_raw) continue;
    const anchor2 = expanduser8(anchor_raw);
    let current_files = /* @__PURE__ */ new Set();
    for (const [src_rel, dest_sub] of plan) {
      const src = path38.join(package_root, src_rel);
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
        reap_stale(tool_id, anchor2, current_files, inventory, true)
      );
    }
    would_reap = would_reap.concat(
      reap_tagged_orphans(
        anchor2,
        plan.map(([, dest_sub]) => dest_sub),
        current_files,
        PACKAGE_TAG_ID,
        true,
        // The ledger spares an edited retired file, so the preview must too.
        recorded_digests(tool_id, anchor2, inventory)
      )
    );
    const paths = [...new Set(would_reap.map((p) => String(p)))].sort();
    if (paths.length > 0) preview[tool_id] = paths;
  }
  return preview;
}
function _verify_deploy_targets(anchor2, plan) {
  const missing = [];
  for (const [, dest_sub] of plan) {
    const target = dest_sub ? path38.join(anchor2, dest_sub) : anchor2;
    const label = dest_sub || ".";
    if (!isDir(target)) {
      missing.push(label);
      continue;
    }
    try {
      const entries = fs39.readdirSync(target);
      if (entries.length === 0) missing.push(label);
    } catch {
      missing.push(label);
    }
  }
  return missing;
}
var _prune_modules_by = prune_modules_by;
var _prune_lab_modules = prune_lab_modules;
var _load_packs_registry = load_packs_registry;
var _compute_active_pack_ids = compute_active_pack_ids;
function _resolve_global_settings_doc() {
  const p = _resolve_global_settings_path();
  return p === null ? null : _load_yaml_doc(p);
}
function _resolve_global_settings_path() {
  const root = event4u_root();
  const canonical = path38.join(root, "settings", SETTINGS_FILE);
  if (pathExists(canonical)) return canonical;
  const legacy = path38.join(root, SETTINGS_FILE);
  if (pathExists(legacy)) return legacy;
  return null;
}
function _resolve_scoped_projection(package_root) {
  const doc = _resolve_global_settings_doc() ?? _load_default_settings(package_root);
  const projection = isPlainObject(doc["projection"]) ? doc["projection"] : {};
  const mode = projectionModeOf(projection["mode"]);
  const runtime = isPlainObject(doc["runtime"]) ? doc["runtime"] : {};
  const active_packs_raw = runtime["active_packs"];
  const active_packs = Array.isArray(active_packs_raw) ? active_packs_raw.filter((v) => typeof v === "string") : [];
  return { mode, active_packs };
}
function _resolve_global_rule_scope(package_root) {
  return resolveGlobalRuleScope({
    settingsPath: _resolve_global_settings_path(),
    packageRoot: package_root,
    readText,
    parseYaml: yamlSafeLoad2,
    loadDefaults: () => _load_default_settings(package_root),
    warn
  });
}
function _rule_filter_for_source(src_rel, scope) {
  if (src_rel !== RULE_SOURCE_REL) return null;
  return (srcFile) => ruleFileArrives(srcFile, scope) && !isExclusivelyPackageOnly(srcFile);
}
var _prune_scoped_modules = prune_scoped_modules;
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
      process4.stdout.write("\n");
      warn("Refusing global install: lockfile records a newer version.");
      info(`  Lockfile:           ${read_path}`);
      info(`  Recorded version:   ${recorded}`);
      info(`  Current package:    ${installed_version}`);
      info("  Fix:                upgrade the package, or re-run with `--force`");
      process4.stdout.write("\n");
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
    process4.stdout.write("\n");
    info("Agent Config \u2014 Global (user-scope) install [ADR-007]");
    info("Per-tool anchor paths:");
    for (const tool_id of [...tools].sort()) {
      const anchor2 = USER_SCOPE_PATHS2[tool_id];
      if (anchor2 === void 0) continue;
      process4.stdout.write(`      ${tool_id.padEnd(15)} \u2192 ${anchor2}
`);
    }
  }
  const existing = read_lockfile(read_path) ?? {};
  const existing_tools = Array.isArray(existing["tools"]) ? existing["tools"] : [];
  const merged_tools = [.../* @__PURE__ */ new Set([...existing_tools, ...tools])].sort();
  const written = write_lockfile(installed_version, merged_tools, { path: write_path });
  if (!state.QUIET) {
    process4.stdout.write("\n");
    info(`Lockfile written: ${written}`);
    info(`  schema_version=1, agent_config_version=${installed_version}`);
    info(`  tools=${merged_tools.join(",")}`);
  }
  if (project_root !== null && pathExists(_resolve_settings_read(project_root)) && !isDir(path38.join(project_root, ".agent-src.uncondensed"))) {
    const drift = collect_drift(project_root);
    if (!state.QUIET) {
      process4.stdout.write("\n");
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
  applyHostListingPolicies({ claudeCode: deploy_results["claude-code"]?.[2] === "deployed", codex: deploy_results["codex"]?.[2] === "deployed" }, os14.homedir(), expanduser8(USER_SCOPE_PATHS2["claude-code"]), state.QUIET ? () => void 0 : info);
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
    process4.stdout.write("\n");
    info("Deployed per-tool content:");
    for (const tool_id of Object.keys(deploy_results).sort()) {
      const [w, s, status] = deploy_results[tool_id];
      const anchor2 = USER_SCOPE_PATHS2[tool_id] ?? "";
      if (status === "deployed" && tool_id === "claude-desktop") {
        const bundles_dir = _claude_desktop_bundles_dir();
        process4.stdout.write(`      ${tool_id.padEnd(15)} \u2192 ${bundles_dir} (${w} bundles)
`);
      } else if (status === "deployed") {
        process4.stdout.write(`      ${tool_id.padEnd(15)} \u2192 ${anchor2} (${w} files, ${s} skipped)
`);
      } else if (status === "marker") {
        process4.stdout.write(
          `      ${tool_id.padEnd(15)} \u2192 ${anchor2}agent-config.md (${w ? "written" : "skipped"})
`
        );
      } else if (status === "hint") {
        process4.stdout.write(
          `      ${tool_id.padEnd(15)} \u2192 no user-scope convention; use \`agent-config export --tool=${tool_id}\`
`
        );
      } else {
        process4.stdout.write(
          `      ${tool_id.padEnd(15)} \u2192 no global-scope content yet (project-scope install supported)
`
        );
      }
    }
  }
  if (project_root !== null && pathExists(_resolve_settings_read(project_root)) && !isDir(path38.join(project_root, ".agent-src.uncondensed"))) {
    const files_by_tool = filesByToolFromDeploy(deploy_results);
    const rc = _update_installed_tools_manifest(project_root, tools, "global", force, files_by_tool);
    if (rc !== 0) return rc;
    const removed_marker = _remove_legacy_consumer_bridge_marker(project_root);
    if (removed_marker !== null && !state.QUIET) {
      const rel = isRelativeTo(removed_marker, project_root) ? path38.relative(project_root, removed_marker) : removed_marker;
      info(`Removed legacy bridge marker: ${rel}`);
    }
    const anchor_paths = _write_per_tool_project_anchors(project_root, tools);
    if (anchor_paths.length > 0 && !state.QUIET) {
      for (const p of anchor_paths) {
        const rel = isRelativeTo(p, project_root) ? path38.relative(project_root, p) : p;
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
        env: process4.env,
        stdinTty: process4.stdin.isTTY === true,
        stdoutTty: process4.stdout.isTTY === true
      });
      if (notice.length > 0) {
        process4.stdout.write("\n");
        for (const line of notice) info(line);
      }
    } catch {
    }
  }
  if (!state.QUIET) {
    process4.stdout.write("\n");
    success(`Global install completed (v${installed_version}).`);
    process4.stdout.write("\n");
  }
  return 0;
}
function _catalogue_truncation_warnings(deploy_results, project_root) {
  const log_candidates = [
    path38.join(event4u_root(), "state", "skill-catalogue.jsonl"),
    ...project_root ? [path38.join(project_root, OBSERVATION_LOG)] : []
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
    const anchor_raw = USER_SCOPE_PATHS2[tool_id];
    if (!anchor_raw) continue;
    const volume = measureCatalogueVolume(tool_id, expanduser8(anchor_raw));
    const warning = catalogueLimitWarning(volume, limit);
    if (warning !== null) lines.push(warning);
  }
  return lines;
}
function _scoped_migration_notice(deploy_results, project_root, package_root, probe) {
  if (!isInteractiveSession(probe)) return [];
  const log_candidates = [
    path38.join(event4u_root(), "state", "skill-catalogue.jsonl"),
    ...project_root ? [path38.join(project_root, OBSERVATION_LOG)] : []
  ];
  const limits = knownHostLimits(log_candidates.flatMap((p) => readObservationLog(p)));
  if (limits.size === 0) return [];
  const resolved = _resolve_scoped_projection(package_root);
  const settings_path = _resolve_global_settings_path() ?? path38.join(event4u_root(), "settings", SETTINGS_FILE);
  for (const tool_id of Object.keys(deploy_results).sort()) {
    const [, , status] = deploy_results[tool_id];
    if (status !== "deployed") continue;
    const anchor_raw = USER_SCOPE_PATHS2[tool_id];
    if (!anchor_raw) continue;
    const volume = measureCatalogueVolume(tool_id, expanduser8(anchor_raw));
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
var SETTINGS_SURFACE_REL = path38.join("state", "settings-surface.json");
var SETTINGS_DELTA_REL = path38.join("state", "settings-delta.json");
function _current_settings_surface(version2) {
  const jsonSchema = toJsonSchema7(settingsSchema, "AgentSettings");
  return flattenSurface(jsonSchema, version2);
}
function _write_settings_surface_snapshot(installed_version) {
  const root = event4u_root();
  const surface_path = path38.join(root, SETTINGS_SURFACE_REL);
  const delta_path = path38.join(root, SETTINGS_DELTA_REL);
  const next = _current_settings_surface(installed_version);
  let previous = null;
  try {
    const parsed = JSON.parse(fs39.readFileSync(surface_path, "utf8"));
    if (parsed !== null && typeof parsed === "object" && parsed.entries !== void 0) previous = parsed;
  } catch {
  }
  if (previous !== null && previous.version !== next.version) {
    const delta = computeSurfaceDelta(previous, next);
    if (delta.changes.length > 0) {
      fs39.mkdirSync(path38.dirname(delta_path), { recursive: true, mode: 448 });
      fs39.writeFileSync(delta_path, `${JSON.stringify(delta, null, 2)}
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
  fs39.mkdirSync(path38.dirname(surface_path), { recursive: true, mode: 448 });
  fs39.writeFileSync(surface_path, `${JSON.stringify(next, null, 2)}
`, { mode: 384 });
}
function arrayStrEqual(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
var PROG = "agent-config install";
var USAGE = `usage: ${PROG} [-h] [--profile PROFILE] [--user-type USER_TYPE] [--force]
                  [--skip-bridges] [--augment-user-hooks]
                  [--cursor-user-hooks] [--cline-user-hooks]
                  [--windsurf-user-hooks] [--gemini-user-hooks]
                  [--project PROJECT] [--package PACKAGE] [--quiet]
                  [--tools TOOLS] [--ai AI] [--packs PACKS] [--core-only]
                  [--no-smoke] [--global] [--full]
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
  "--dry-run": "dry_run",
  "--full": "full"
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
  process4.stderr.write(USAGE);
  process4.stderr.write(`${PROG}: error: ${msg}
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
    full: false,
    apply_payload: null,
    layer: null
  };
  const positionals = [];
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a === "-h" || a === "--help") {
      process4.stdout.write(USAGE);
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
  opts.tools = mergeToolsAliases(opts.tools, opts.ai);
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
  const unknown2 = items.filter((s) => !_VALID_TOOLS.has(s));
  if (unknown2.length > 0) {
    fail(
      `--tools: unknown ID(s): ${unknown2.join(", ")} (valid: ${[..._VALID_TOOLS].sort().join(", ")})`
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
  const start = resolvePath(_HERE4);
  const chain = [start];
  let cur = start;
  for (; ; ) {
    const parent = path38.dirname(cur);
    if (parent === cur) break;
    chain.push(parent);
    cur = parent;
  }
  for (const ancestor of chain) {
    const candidate = path38.join(ancestor, "src", "templates", "minimal");
    if (isDir(candidate)) return candidate;
  }
  fail("Could not locate src/templates/minimal/ \u2014 package install is corrupt.");
}
var INSTALL_MODE_MARKER_REL = "agents/.agent-state/install-mode.txt";
function _write_install_mode_marker(project_root, mode) {
  if (mode !== "minimal" && mode !== "full") return;
  const marker = path38.join(project_root, INSTALL_MODE_MARKER_REL);
  try {
    mkdirp(path38.dirname(marker));
    writeText(marker, `${mode}
`);
  } catch {
  }
}
function install_minimal(target_root_in, force, user_type = "") {
  let target_root = resolvePath(target_root_in);
  mkdirp(target_root);
  const parent = path38.dirname(target_root);
  if (parent !== target_root) {
    const existing = find_project_root_with_anchor(parent);
    if (existing !== null && existing[0] !== target_root) {
      const [root, anchor2] = existing;
      fail(
        `Refusing to nest an agent-config layer inside an existing project (anchor: ${anchor2}). Existing root: ${root}. Remove the parent layer first or run \`--minimal\` outside it.`
      );
    }
  }
  const templates = _minimal_templates_root();
  const settings_src = path38.join(templates, SETTINGS_FILE);
  const overrides_gitkeep_src = path38.join(templates, "overrides-gitkeep");
  const overrides_readme_src = path38.join(templates, "agents-overrides-readme.md");
  if (!isFile(settings_src)) fail(`Bundled minimal settings template missing under ${templates}`);
  if (!isFile(overrides_gitkeep_src) || !isFile(overrides_readme_src)) {
    fail(`Bundled overrides scaffold templates missing under ${templates}`);
  }
  info(`Minimal init \u2192 ${target_root}`);
  const overrides_root = path38.join(target_root, "agents", "overrides");
  mkdirp(overrides_root);
  const gitkeep_body = readText(overrides_gitkeep_src);
  for (const sub of ["rules", "skills", "commands"]) {
    const sub_dir = path38.join(overrides_root, sub);
    mkdirp(sub_dir);
    const gitkeep_dst = path38.join(sub_dir, ".gitkeep");
    if (pathExists(gitkeep_dst) && !force) {
      skip(`agents/overrides/${sub}/.gitkeep already exists (use --force to overwrite)`);
    } else {
      writeText(gitkeep_dst, gitkeep_body);
      success(`Wrote agents/overrides/${sub}/.gitkeep`);
    }
  }
  const readme_dst = path38.join(overrides_root, "README.md");
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
      mkdirp(path38.dirname(settings_dst));
      writeText(settings_dst, body);
      success(`Wrote ${SETTINGS_FILE} (user_type=${user_type})`);
    }
  }
  const removed_marker = _remove_legacy_consumer_bridge_marker(target_root);
  if (removed_marker !== null) {
    const rel = isRelativeTo(removed_marker, target_root) ? path38.relative(target_root, removed_marker) : removed_marker;
    success(`Removed legacy bridge marker: ${rel}`);
  }
  _write_install_mode_marker(target_root, "minimal");
  if (!state.QUIET) {
    process4.stderr.write(
      "\u2139\uFE0F   Minimal install \u2014 run `agent-config install --force` to add AGENTS.md, bridges, and tool integrations.\n"
    );
  }
  if (!state.QUIET) {
    process4.stdout.write("\n");
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
  process4.stdout.write("\n");
  process4.stdout.write(`  ${label}
`);
  options.forEach(([key, blurb], idx) => {
    process4.stdout.write(`    ${idx + 1}. ${key}  \u2014 ${blurb}
`);
  });
  process4.stdout.write("\n");
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
    process4.stdout.write(
      `  \u26A0\uFE0F  Pick a number 1-${options.length} or one of: ${options.map(([k]) => k).join(", ")}.
`
    );
  }
}
function run_interactive_init(project_root, force) {
  if (!process4.stdin.isTTY) {
    warn(
      `--interactive requested but stdin is not a TTY; skipping the prompt. Re-run interactively or hand-edit ${_LOCAL_CONFIG_FILE}.`
    );
    return 0;
  }
  const target = path38.join(project_root, _LOCAL_CONFIG_FILE);
  if (pathExists(target) && !force) {
    warn(
      `${_LOCAL_CONFIG_FILE} already exists; re-run with --force to overwrite. Skipping interactive init.`
    );
    return 0;
  }
  process4.stdout.write("\n");
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
  success(`Wrote ${path38.relative(project_root, target)} (${user_type} / ${stack} / ${verbosity})`);
  return 0;
}
var _WIZARD_READY_RE = /^WIZARD_READY (http:\/\/(?:127\.0\.0\.1|localhost):\d+\/\S*)\r?$/;
var _WIZARD_TIMEOUTS = [10, 20, 40, 80];
function _wizard_should_launch(opts) {
  if (opts.no_ui) return [false, "--no-ui flag set"];
  const env_no_ui = (process4.env["AGENT_CONFIG_NO_UI"] ?? "").trim();
  if (env_no_ui && env_no_ui !== "0") return [false, "AGENT_CONFIG_NO_UI env set"];
  if ((process4.env["CI"] ?? "").trim()) return [false, "CI environment detected"];
  if (!process4.stdout.isTTY) return [false, "stdout is not a TTY"];
  const tools_raw = opts.tools;
  if (tools_raw && !_tools_was_all(tools_raw)) {
    return [false, "explicit --tools= selection (headless install)"];
  }
  return [true, ""];
}
function _wizard_cli_dist(_project_root) {
  const package_root = path38.dirname(path38.dirname(path38.dirname(resolvePath(_HERE4))));
  const cli = path38.join(package_root, "dist", "cli", "agent-config.js");
  return pathExists(cli) ? cli : null;
}
function _server_info_path() {
  return path38.join(os14.homedir(), ".event4u", "agent-config", "local-server.json");
}
function _pid_is_agent_config(pid) {
  let res;
  try {
    res = spawnSync3("ps", ["-p", String(pid), "-o", "command="], {
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
    fs39.unlinkSync(p);
  } catch {
  }
}
function pidAlive(pid) {
  try {
    process4.kill(pid, 0);
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
    process4.kill(pid, "SIGTERM");
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
      process4.kill(pid, "SIGKILL");
    } catch {
    }
  }
  unlinkMissingOk(p);
  process4.stdout.write("(Stopped the previous wizard server.)\n");
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
    process4.stdout.write(
      "(Wizard not available \u2014 CLI bundle not built. Run 'npm run build' at the package root to produce dist/cli/.)\n"
    );
    return 0;
  }
  const cmd = ["node", cli, "install", "--no-open"];
  if (pass_project_root) {
    cmd.push("--project-root", project_root);
  }
  const env = { ...process4.env };
  return _wizard_run_sync(cmd, env, cli);
}
function _wizard_run_sync(cmd, env, cli) {
  const total = _WIZARD_TIMEOUTS.reduce((a, b) => a + b, 0);
  const log_path = path38.join(
    os14.tmpdir(),
    `agent-config-wizard-${process4.pid}-${Date.now()}.log`
  );
  let child;
  let log_fd = null;
  try {
    log_fd = fs39.openSync(log_path, "w");
    child = spawn(cmd[0], cmd.slice(1), {
      env,
      detached: true,
      stdio: ["ignore", log_fd, log_fd]
    });
    child.on("error", () => {
    });
    child.unref();
  } catch (exc) {
    process4.stdout.write(
      `(Wizard failed to start: ${String(exc)}; run 'node ${cli} install --no-open' manually.)
`
    );
    return 0;
  } finally {
    if (log_fd !== null) {
      try {
        fs39.closeSync(log_fd);
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
    process4.stdout.write(
      `(Wizard server did not report ready within ${Math.trunc(total)}s; run 'node ${cli} install --no-open' manually.)
  Last output:
  ${tail}
`
    );
    return 0;
  }
  process4.stdout.write("\n");
  process4.stdout.write(`Setup wizard ready: ${matched_url}
`);
  _openBrowser(matched_url);
  process4.stdout.write(
    "(Wizard server keeps running in the background \u2014 finish the wizard in the browser tab; the next install run stops any stale server.)\n"
  );
  return 0;
}
function _openBrowser(url) {
  try {
    const opener = process4.platform === "darwin" ? ["open", [url]] : process4.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : ["xdg-open", [url]];
    spawnSync3(opener[0], opener[1], { stdio: "ignore" });
  } catch {
  }
}
function _dry_run_summary(opts) {
  const target = resolvePath(
    opts.custom_path || opts.project || process4.env["PROJECT_ROOT"] || process4.cwd()
  );
  const [will_launch, why_not] = _wizard_should_launch(opts);
  process4.stdout.write("\n");
  process4.stdout.write("[dry-run] Plan summary \u2014 no files written, no subprocesses spawned:\n");
  process4.stdout.write(`  profile:     ${opts.profile}
`);
  process4.stdout.write(`  user-type:   ${opts.user_type || "(none)"}
`);
  process4.stdout.write(`  scope:       ${opts.scope || (opts.global_install ? "global" : "auto")}
`);
  process4.stdout.write(`  tools:       ${opts.tools || "all"}
`);
  process4.stdout.write(dryRunTargetLines(Boolean(opts.global_install) || opts.scope === "global", _parse_tools(opts.tools || "all"), target));
  process4.stdout.write(`  minimal:     ${pyBool(opts.minimal)}
`);
  process4.stdout.write(`  force:       ${pyBool(opts.force)}
`);
  process4.stdout.write(`  offline:     ${pyBool(opts.offline)}
`);
  if (will_launch) {
    process4.stdout.write("  wizard:      Would auto-launch (pass --no-ui to suppress).\n");
  } else {
    process4.stdout.write(`  wizard:      Suppressed (${why_not}).
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
    process4.stdout.write("\n");
    if (total === 0) {
      process4.stdout.write("  reap (cleanup): nothing to reap \u2014 no stale deployed files.\n");
    } else {
      process4.stdout.write(`  reap (cleanup): would remove ${total} stale file(s):
`);
      for (const tool_id of Object.keys(preview).sort()) {
        for (const p of preview[tool_id]) {
          process4.stdout.write(`      ${tool_id}: ${p}
`);
        }
      }
    }
  }
  process4.stdout.write("\n");
  return 0;
}
function pyBool(v) {
  return v ? "True" : "False";
}
function _apply_payload_preview(payload, opts) {
  const schema_version = payload["schema_version"] ?? "<missing>";
  const target = resolvePath(
    opts.custom_path || opts.project || process4.env["PROJECT_ROOT"] || process4.cwd()
  );
  process4.stdout.write("\n");
  process4.stdout.write(
    "[apply-payload] Plan summary \u2014 no files written, no subprocesses spawned:\n"
  );
  process4.stdout.write(`  schema:      ${schema_version}
`);
  if (schema_version === "wizard-v2") {
    const tools = payload["tools"] || [];
    const packs = payload["packs"] || [];
    const settings = payload["settings"] || {};
    const scope_to_project = Boolean(payload["scope_to_project_only"] ?? false);
    process4.stdout.write(`  tools:       ${tools.length ? tools.join(",") : "(none)"}
`);
    process4.stdout.write(`  packs:       ${packs.length ? packs.join(",") : "(base)"}
`);
    process4.stdout.write(`  settings:    ${Object.keys(settings).length} top-level key(s)
`);
    process4.stdout.write(`  scope:       ${scope_to_project ? "project" : "global"}
`);
  } else if (schema_version === "installer-v1") {
    const ai_tools = payload["ai_tools"] || [];
    const configs = payload["configs"] || {};
    process4.stdout.write(`  ai_tools:    ${ai_tools.length ? ai_tools.join(",") : "(none)"}
`);
    process4.stdout.write(`  configs:     ${Object.keys(configs).length} tool config(s)
`);
  } else {
    process4.stdout.write(`  error:       unsupported schema_version: ${pyRepr(schema_version)}
`);
    process4.stdout.write("\n");
    return 2;
  }
  process4.stdout.write(`  target:      ${target}
`);
  process4.stdout.write(`  dry_run:     ${pyBool(Boolean(payload["dry_run"] ?? opts.dry_run))}
`);
  process4.stdout.write("\n");
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
  state.FULL_PIN = opts.full || _legacy_projection_pin();
  if (opts.apply_payload) {
    const payload_path = resolvePath(opts.apply_payload);
    if (!isFile(payload_path)) fail(`--apply-payload path not found: ${payload_path}`);
    let payload;
    try {
      payload = JSON.parse(readText(payload_path));
    } catch (exc) {
      fail(`--apply-payload JSON parse error: ${String(exc)}`);
    }
    if (!isPlainObject(payload)) fail("--apply-payload root must be a JSON object");
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
      if (isPlainObject(settings)) {
        const rule_loading_tier = settings["rule_loading_tier"] || settings["cost_profile"];
        if (typeof rule_loading_tier === "string" && rule_loading_tier) {
          opts.profile = rule_loading_tier;
        }
        const personal = settings["personal"];
        if (isPlainObject(personal)) {
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
    process4.env["AGENT_CONFIG_OFFLINE"] = "1";
    process4.env["AGENT_CONFIG_NO_UPDATE_CHECK"] = "1";
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
      opts.custom_path || opts.project || process4.env["PROJECT_ROOT"] || process4.cwd()
    );
    const minimal_package_root = path38.dirname(
      path38.dirname(path38.dirname(_minimal_templates_root()))
    );
    const validated_user_type = _validate_user_type(minimal_package_root, opts.user_type);
    return install_minimal(target_root, opts.force, validated_user_type);
  }
  const detect_root = resolvePath(opts.project || process4.env["PROJECT_ROOT"] || process4.cwd());
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
    tracker.begin(detect_root);
    const rc2 = tracker.finalizeRc(
      install_global(parsed_tools, opts.force, detect_root, opts.core_only)
    );
    _emit_progress_terminal(rc2);
    if ((rc2 === 0 || rc2 === EXIT_COMPLETED_WITH_CONFLICTS) && wizard_handoff) {
      const wizard_rc = _wizard_spawn(detect_root, false);
      return wizard_rc === 0 ? rc2 : wizard_rc;
    }
    return rc2;
  }
  const project_root = custom_path || resolvePath(opts.project || process4.env["PROJECT_ROOT"] || process4.cwd());
  const is_first_run = !pathExists(path38.join(project_root, SETTINGS_FILE));
  tracker.begin(project_root);
  let rc = _main_project_install(opts, project_root, parsed_tools, is_first_run);
  if (rc === 0 && opts.interactive) {
    run_interactive_init(project_root, opts.force);
  }
  rc = tracker.finalizeRc(rc);
  _emit_progress_terminal(rc);
  return rc;
}
function _propose_modules_config(project_root, is_first_run) {
  if (!is_first_run || state.QUIET || !process4.stdin.isTTY || !process4.stdout.isTTY) return;
  let candidates;
  try {
    candidates = detect_module_roots(project_root);
  } catch {
    return;
  }
  if (!candidates || candidates.length === 0) return;
  process4.stdout.write("\n");
  info("Module-root candidates detected \u2014 propose `modules:` block");
  info("Paste into .agent-project-settings.yml to enable module-aware skills (or skip; the block stays opt-in).");
  process4.stdout.write("\n");
  process4.stdout.write("  modules:\n");
  process4.stdout.write("    enabled: true\n");
  process4.stdout.write("    root_paths: [" + candidates.map((c) => c.path).join(", ") + "]\n");
  const primary_ns = candidates.find((c) => c.namespace_template_guess)?.namespace_template_guess ?? "";
  if (primary_ns) {
    process4.stdout.write(`    namespace_template: '${primary_ns}'
`);
  }
  process4.stdout.write("    agent_folder: agents\n");
  process4.stdout.write("    skip_dirs: [.module-template, .example]\n");
  process4.stdout.write("\n");
  info(
    "Re-run anytime via `./scripts-run src/scripts/propose_modules_config` (installed under <package>/src/scripts/)."
  );
}
var _ABSENT_LAYER = ["project-settings", "template"].map((n) => path38.join(path38.sep, "dev", "null", `agent-config-absent-${n}.yml`));
function _legacy_projection_pin() {
  let data = null;
  try {
    data = load_agent_settings({ project_path: _ABSENT_LAYER[0], template_path: _ABSENT_LAYER[1] });
  } catch {
  }
  return legacyProjectionPin(data, (line) => warn(line));
}
function _read_consumer_auto_switch(project_root) {
  let data;
  try {
    data = load_agent_settings({ project_path: _resolve_settings_read(project_root) });
  } catch {
    return "suggest";
  }
  const model = isPlainObject(data) ? data["model"] : null;
  const value = isPlainObject(model) ? model["auto_switch"] : null;
  if (typeof value === "string" && ["auto", "suggest", "off"].includes(value.trim().toLowerCase())) {
    return value.trim().toLowerCase();
  }
  return "suggest";
}
function _team_setup_hint_line() {
  return "  \u2022 Claude Code team mode (optional cross-model review via the official codex plugin): run `agent-config doctor --check team` for setup status.";
}
function finalize_claude_model_tiers(project_root) {
  const claude_skills = path38.join(project_root, ".claude", "skills");
  const augment_skills = path38.join(project_root, ".augment", "skills");
  if (!isDir(claude_skills) || !isDir(augment_skills)) return 0;
  if (_read_consumer_auto_switch(project_root) !== "auto") return 0;
  let rendered = 0;
  const entries = fs39.readdirSync(claude_skills).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  for (const name of entries) {
    const entry = path38.join(claude_skills, name);
    const src_dir = path38.join(augment_skills, name);
    const src_md = path38.join(src_dir, "SKILL.md");
    let tier;
    try {
      tier = read_model_tier(src_md);
    } catch {
      tier = null;
    }
    if (tier === null || !(tier in TIER_TO_CLAUDE_MODEL) || !isDir(src_dir)) continue;
    if (isSymlink(entry) || isFile(entry)) {
      fs39.unlinkSync(entry);
    } else if (isDir(entry)) {
      fs39.rmSync(entry, { recursive: true, force: true });
    }
    mkdirp(entry);
    const srcFiles = fs39.readdirSync(src_dir).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
    for (const fname of srcFiles) {
      if (fname === "SKILL.md") {
        writeText(
          path38.join(entry, "SKILL.md"),
          render_native_model_md(readText(src_md), tier)
        );
      } else {
        fs39.symlinkSync(
          path38.join("../../../.augment/skills", name, fname),
          path38.join(entry, fname)
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
    if (!pathExists(path38.join(package_root, "src", "config", "profiles", "minimal.ini"))) {
      fail(`Invalid --package path (missing src/config/profiles/minimal.ini): ${package_root}`);
    }
    package_type = detect_package_type_for_project(project_root, package_root);
  } else {
    package_root = detect_package_root(project_root);
    package_type = detect_package_type(package_root);
  }
  if (!state.QUIET) {
    process4.stdout.write("\n");
    info("Agent Config \u2014 Project Bridge Installer");
    info(`Project:  ${project_root}`);
    info(`Package:  ${package_root}`);
    info(`Type:     ${package_type}`);
    info(`Profile:  ${opts.profile}`);
    if (opts.user_type) info(`UserType: ${opts.user_type}`);
    process4.stdout.write("\n");
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
    registerMcpHosts(merge_json_file, project_root, opts.force, package_root, tools, merged_keys_by_tool);
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
  const tier_advisory = _tier_b_advisory(package_root);
  if (tier_advisory !== null && !state.QUIET) {
    info(tier_advisory);
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
      process4.stdout.write("\n");
      info("Smoke-testing installed hook bridges (dry-run)");
    }
    _smoke_test_hooks(project_root, package_root);
  }
  if (!opts.skip_bridges) {
    const files_by_tool = filesByToolFromBridges(parsed_tools, project_root, "project", _bridge_marker);
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
    process4.stdout.write("\n");
    success("Done.");
    if (is_first_run) {
      process4.stdout.write("\n");
      process4.stdout.write("  Try these 3 prompts with your agent:\n");
      process4.stdout.write('    1. "Refactor this function"   \u2192 agent analyzes first\n');
      process4.stdout.write('    2. "Add caching to this"      \u2192 agent asks instead of guessing\n');
      process4.stdout.write('    3. "Implement this feature"   \u2192 agent respects your codebase\n');
      process4.stdout.write("\n");
      process4.stdout.write("  Next steps:\n");
      process4.stdout.write("    \u2022 Commit .agent-settings.yml and bridge files to your repo\n");
      process4.stdout.write("    \u2022 New team members run `npx @event4u/agent-config init` \u2014 done\n");
      process4.stdout.write("    \u2022 Inspect hook coverage: ./agent-config hooks:status\n");
      process4.stdout.write(
        "    \u2022 Full walkthrough: https://github.com/event4u-app/agent-config/blob/main/docs/getting-started.md\n"
      );
      process4.stdout.write("\n");
    } else {
      process4.stdout.write(
        "  Re-run complete. Walkthrough: https://github.com/event4u-app/agent-config/blob/main/docs/getting-started.md\n"
      );
      process4.stdout.write("\n");
    }
    printResiduals(tools, state.QUIET);
    if (_is_tool_enabled(tools, "claude-code")) {
      process4.stdout.write(_team_setup_hint_line() + "\n");
      process4.stdout.write("\n");
    }
  }
  _propose_modules_config(project_root, is_first_run);
  const will_launch = _wizard_should_launch(opts)[0];
  if (will_launch) {
    return _wizard_spawn(project_root);
  }
  const ign = write_managed_block(project_root, opts.dry_run);
  if (ign > 0) success(`.gitignore: ${opts.dry_run ? "would add " : "+"}${ign} managed entries`);
  return 0;
}
function _resolvedArgv1() {
  if (process4.argv[1] === void 0) return void 0;
  try {
    return fs39.realpathSync(path38.resolve(process4.argv[1]));
  } catch {
    return path38.resolve(process4.argv[1]);
  }
}
var _argv1 = _resolvedArgv1();
var _isCliEntry2 = _argv1 !== void 0 && import.meta.url === pathToFileURL2(_argv1).href;
if (_isCliEntry2 || _argv1 === _HERE4) {
  try {
    process4.exitCode = main2(process4.argv.slice(2));
  } catch (e) {
    if (e instanceof SystemExitError || e instanceof ArgparseExit2) {
      process4.exitCode = e.code;
    } else {
      throw e;
    }
  }
}
export {
  AIDER_MARKER,
  ArgparseExit2 as ArgparseExit,
  CLAUDE_DESKTOP_MARKER,
  CODEX_MARKER,
  CONTINUE_MARKER,
  DEFAULT_PROFILE,
  GLOBAL_AGENT_SETTINGS_PATH,
  GLOBAL_DEPLOY_SOURCES,
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
  USER_SCOPE_PATHS2 as USER_SCOPE_PATHS,
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
  filesByToolFromBridges as _files_by_tool_from_bridges,
  filesByToolFromDeploy as _files_by_tool_from_deploy,
  _format_global_root_for_marker,
  _gate_rule_layer_overlap,
  _inject_packs,
  _is_agent_config_source_repo,
  _is_tool_enabled,
  _load_packs_registry,
  mergeToolsAliases as _merge_tools_aliases,
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
  _tier_b_advisory,
  _tools_was_all,
  _update_installed_tools_manifest,
  _validate_scope,
  _verify_deploy_targets,
  _wizard_should_launch,
  _write_settings_surface_snapshot,
  _yaml_scalar,
  deepMerge as deep_merge,
  detect_package_type,
  detect_package_type_for_project,
  detect_scope,
  ensure_cline_bridge,
  ensure_cursor_bridge,
  ensure_gemini_bridge,
  ensure_mcp_bridge,
  ensure_windsurf_bridge,
  finalize_claude_model_tiers,
  jsonDumpsCompact,
  jsonDumpsIndent,
  main2 as main,
  parse_options,
  smokeProbeEvents,
  state,
  tracker
};
