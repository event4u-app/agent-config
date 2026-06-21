#!/usr/bin/env tsx
var __getOwnPropNames = Object.getOwnPropertyNames;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

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
    function visit_(key, node, visitor, path11) {
      const ctrl = callVisitor(key, node, visitor, path11);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path11, ctrl);
        return visit_(key, ctrl, visitor, path11);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path11 = Object.freeze(path11.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = visit_(i, node.items[i], visitor, path11);
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
          path11 = Object.freeze(path11.concat(node));
          const ck = visit_("key", node.key, visitor, path11);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = visit_("value", node.value, visitor, path11);
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
    async function visitAsync_(key, node, visitor, path11) {
      const ctrl = await callVisitor(key, node, visitor, path11);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path11, ctrl);
        return visitAsync_(key, ctrl, visitor, path11);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path11 = Object.freeze(path11.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = await visitAsync_(i, node.items[i], visitor, path11);
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
          path11 = Object.freeze(path11.concat(node));
          const ck = await visitAsync_("key", node.key, visitor, path11);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = await visitAsync_("value", node.value, visitor, path11);
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
    function callVisitor(key, node, visitor, path11) {
      if (typeof visitor === "function")
        return visitor(key, node, path11);
      if (identity.isMap(node))
        return visitor.Map?.(key, node, path11);
      if (identity.isSeq(node))
        return visitor.Seq?.(key, node, path11);
      if (identity.isPair(node))
        return visitor.Pair?.(key, node, path11);
      if (identity.isScalar(node))
        return visitor.Scalar?.(key, node, path11);
      if (identity.isAlias(node))
        return visitor.Alias?.(key, node, path11);
      return void 0;
    }
    function replaceNode(key, path11, node) {
      const parent = path11[path11.length - 1];
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
              const isValid = /^\d+\.\d+$/.test(version);
              onError(6, `Unsupported YAML version ${version}`, isValid);
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
    function collectionFromPath(schema, path11, value) {
      let v = value;
      for (let i = path11.length - 1; i >= 0; --i) {
        const k = path11[i];
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
    var isEmptyPath = (path11) => path11 == null || typeof path11 === "object" && !!path11[Symbol.iterator]().next().done;
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
      addIn(path11, value) {
        if (isEmptyPath(path11))
          this.add(value);
        else {
          const [key, ...rest] = path11;
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
      deleteIn(path11) {
        const [key, ...rest] = path11;
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
      getIn(path11, keepScalar) {
        const [key, ...rest] = path11;
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
      hasIn(path11) {
        const [key, ...rest] = path11;
        if (rest.length === 0)
          return this.has(key);
        const node = this.get(key, true);
        return identity.isCollection(node) ? node.hasIn(rest) : false;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path11, value) {
        const [key, ...rest] = path11;
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
      addIn(path11, value) {
        if (assertCollection(this.contents))
          this.contents.addIn(path11, value);
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
      deleteIn(path11) {
        if (Collection.isEmptyPath(path11)) {
          if (this.contents == null)
            return false;
          this.contents = null;
          return true;
        }
        return assertCollection(this.contents) ? this.contents.deleteIn(path11) : false;
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
      getIn(path11, keepScalar) {
        if (Collection.isEmptyPath(path11))
          return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
        return identity.isCollection(this.contents) ? this.contents.getIn(path11, keepScalar) : void 0;
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
      hasIn(path11) {
        if (Collection.isEmptyPath(path11))
          return this.contents !== void 0;
        return identity.isCollection(this.contents) ? this.contents.hasIn(path11) : false;
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
      setIn(path11, value) {
        if (Collection.isEmptyPath(path11)) {
          this.contents = value;
        } else if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, Array.from(path11), value);
        } else if (assertCollection(this.contents)) {
          this.contents.setIn(path11, value);
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
    visit.itemAtPath = (cst, path11) => {
      let item = cst;
      for (const [field, index] of path11) {
        const tok = item?.[field];
        if (tok && "items" in tok) {
          item = tok.items[index];
        } else
          return void 0;
      }
      return item;
    };
    visit.parentCollection = (cst, path11) => {
      const parent = visit.itemAtPath(cst, path11.slice(0, -1));
      const field = path11[path11.length - 1][0];
      const coll = parent?.[field];
      if (coll && "items" in coll)
        return coll;
      throw new Error("Parent collection not found");
    };
    function _visit(path11, item, visitor) {
      let ctrl = visitor(item, path11);
      if (typeof ctrl === "symbol")
        return ctrl;
      for (const field of ["key", "value"]) {
        const token = item[field];
        if (token && "items" in token) {
          for (let i = 0; i < token.items.length; ++i) {
            const ci = _visit(Object.freeze(path11.concat([[field, i]])), token.items[i], visitor);
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
            ctrl = ctrl(item, path11);
        }
      }
      return typeof ctrl === "function" ? ctrl(item, path11) : ctrl;
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
              const fs13 = this.flowScalar(this.type);
              if (atNextItem || it.value) {
                map.items.push({ start, key: fs13, sep: [] });
                this.onKeyLine = true;
              } else if (it.sep) {
                this.stack.push(fs13);
              } else {
                Object.assign(it, { key: fs13, sep: [] });
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
              const fs13 = this.flowScalar(this.type);
              if (!it || it.value)
                fc.items.push({ start: [], key: fs13, sep: [] });
              else if (it.sep)
                this.stack.push(fs13);
              else
                Object.assign(it, { key: fs13, sep: [] });
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
    function parse(src, reviver, options) {
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
    exports.parse = parse;
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
import { spawnSync as spawnSync2 } from "node:child_process";
import * as crypto2 from "node:crypto";
import * as fs12 from "node:fs";
import * as os6 from "node:os";
import * as path10 from "node:path";
import process3 from "node:process";
import { fileURLToPath as fileURLToPath3, pathToFileURL as pathToFileURL2 } from "node:url";

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
function read_lockfile(path11) {
  const target = path11 ?? lockfile_path();
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
function _render(version, tools, installed_at) {
  const lines = [
    `schema_version: ${SCHEMA_VERSION}`,
    `install_layout_version: ${INSTALL_LAYOUT_VERSION}`,
    `agent_config_version: "${version}"`,
    `installed_at: "${installed_at}"`,
    "tools:"
  ];
  for (const tool of tools) {
    lines.push(`  - ${tool}`);
  }
  return lines.join("\n") + "\n";
}
function write_lockfile(version, tools, options = {}) {
  const target = options.path ?? lockfile_path();
  fs2.mkdirSync(path2.dirname(target), { recursive: true });
  const stamp = strftime_iso_z(options.now ?? /* @__PURE__ */ new Date());
  const rendered = _render(version, sorted_unique(tools), stamp);
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
  write_lockfile(version, tools, { path: target, now: when });
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
function current_package_version(repo_root) {
  let root = repo_root ?? null;
  if (root === null) {
    const here = path2.dirname(fileURLToPath(import.meta.url));
    root = path2.resolve(here, "..", "..", "..");
  }
  try {
    const data = JSON.parse(fs2.readFileSync(path2.join(root, "package.json"), { encoding: "utf-8" }));
    const version = data.version;
    if (typeof version === "string" && version.trim()) {
      return version.trim();
    }
  } catch {
  }
  return "0.0.0";
}

// src/scripts/_lib/surface_tiers.ts
import * as fs3 from "node:fs";
import * as path3 from "node:path";
var _LAB_FALLBACK = /* @__PURE__ */ new Set(["ai-video", "ai-image", "fun"]);
function load_lab_pack_ids(repo_root) {
  const vocab = path3.join(repo_root, "src", "config", "discovery", "packs.yml");
  const ids = /* @__PURE__ */ new Set();
  try {
    const YAML = require_dist();
    const data = YAML.parse(fs3.readFileSync(vocab, "utf-8"), { version: "1.1" });
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

// src/scripts/_lib/global_deploy_inventory.ts
import { randomBytes as randomBytes2 } from "node:crypto";
import * as fs4 from "node:fs";
import * as os3 from "node:os";
import * as path4 from "node:path";
var SCHEMA_VERSION2 = 1;
var INVENTORY_BASENAME = "deployed-files.json";
var INVENTORY_ENV = "AGENT_CONFIG_DEPLOY_INVENTORY";
function expanduser3(p) {
  if (p === "~") {
    return os3.homedir();
  }
  if (p.startsWith("~/") || process.platform === "win32" && p.startsWith("~\\")) {
    return path4.join(os3.homedir(), p.slice(2));
  }
  return p;
}
function resolve_path(p) {
  try {
    return fs4.realpathSync(p);
  } catch {
    const abs = path4.resolve(p);
    const parts = abs.split(path4.sep);
    for (let i = parts.length; i > 0; i -= 1) {
      const prefix = parts.slice(0, i).join(path4.sep) || path4.sep;
      try {
        const real = fs4.realpathSync(prefix);
        const rest = parts.slice(i);
        return rest.length > 0 ? path4.join(real, ...rest) : real;
      } catch {
        continue;
      }
    }
    return abs;
  }
}
function path_exists(p) {
  try {
    fs4.statSync(p);
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
    data = JSON.parse(fs4.readFileSync(target, { encoding: "utf-8" }));
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
  fs4.mkdirSync(path4.dirname(target), { recursive: true });
  const payload = json_dumps_sorted(data, 2) + "\n";
  const parent = path4.dirname(target);
  let fd = null;
  let tmp_name = "";
  for (let attempt = 0; attempt < 32; attempt += 1) {
    tmp_name = path4.join(parent, `${path4.basename(target)}.${randomBytes2(6).toString("hex")}`);
    try {
      fd = fs4.openSync(tmp_name, "wx", 384);
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
    fs4.writeFileSync(fd, payload, { encoding: "utf-8" });
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
function expected_deploy_files(src, dest_rel) {
  const out = /* @__PURE__ */ new Set();
  let src_stat;
  try {
    src_stat = fs4.statSync(src);
  } catch {
    return out;
  }
  if (!src_stat.isDirectory()) {
    out.add(as_posix(dest_rel));
    return out;
  }
  const _walk = (node, prefix) => {
    const entries = fs4.readdirSync(node).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
    for (const name of entries) {
      const entry = path4.join(node, name);
      const rel = join_rel(prefix, name);
      const lst = fs4.lstatSync(entry);
      if (lst.isDirectory() && !lst.isSymbolicLink()) {
        _walk(entry, rel);
        continue;
      }
      let resolved_is_dir = false;
      try {
        resolved_is_dir = fs4.statSync(entry).isDirectory();
      } catch {
        resolved_is_dir = false;
      }
      if (resolved_is_dir) {
        _walk(fs4.realpathSync(entry), rel);
        continue;
      }
      out.add(as_posix(rel));
    }
  };
  _walk(src, dest_rel);
  return out;
}
function join_rel(prefix, name) {
  return prefix ? path4.join(prefix, name) : name;
}
function as_posix(p) {
  if (p === "") {
    return ".";
  }
  return p.split(path4.sep).join("/");
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
    const target = path4.join(anchor_resolved, rel);
    try {
      relative_to(resolve_path(path4.dirname(target)), anchor_resolved);
    } catch {
      continue;
    }
    let lst = null;
    try {
      lst = fs4.lstatSync(target);
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
      fs4.unlinkSync(target);
    } catch {
      continue;
    }
    deleted.push(target);
    prune_candidates.add(path4.dirname(target));
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
    const root = dest_sub ? path4.join(anchor_resolved, dest_sub) : anchor_resolved;
    let root_stat;
    try {
      root_stat = fs4.statSync(root);
    } catch {
      continue;
    }
    if (!root_stat.isDirectory()) {
      continue;
    }
    for (const md of rglob_md(root)) {
      let md_lst;
      try {
        md_lst = fs4.lstatSync(md);
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
        relative_to(resolve_path(path4.dirname(md)), anchor_resolved);
      } catch {
        continue;
      }
      let head;
      try {
        head = fs4.readFileSync(md, { encoding: "utf-8" });
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
        fs4.unlinkSync(md);
      } catch {
        continue;
      }
      deleted.push(md);
      prune_candidates.add(path4.dirname(md));
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
    (a, b) => b.split(path4.sep).length - a.split(path4.sep).length
  );
  for (const start of ordered) {
    let node = start;
    while (node !== anchor_resolved && is_ancestor(anchor_resolved, node)) {
      try {
        fs4.rmdirSync(node);
      } catch {
        break;
      }
      node = path4.dirname(node);
    }
  }
}
function is_ancestor(anchor, node) {
  const rel = path4.relative(anchor, node);
  return rel !== "" && !rel.startsWith("..") && !path4.isAbsolute(rel);
}
function relative_to(child, parent) {
  if (child === parent) {
    return "";
  }
  const rel = path4.relative(parent, child);
  if (rel.startsWith("..") || path4.isAbsolute(rel)) {
    throw new Error(`'${child}' is not in the subpath of '${parent}'`);
  }
  return rel;
}
function relative_to_posix(child, parent) {
  return path4.relative(parent, child).split(path4.sep).join("/");
}
function rglob_md(root) {
  const out = [];
  const walk = (dir) => {
    let names;
    try {
      names = fs4.readdirSync(dir).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
    } catch {
      return;
    }
    for (const name of names) {
      const full = path4.join(dir, name);
      let lst;
      try {
        lst = fs4.lstatSync(full);
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

// src/scripts/_lib/installed_tools.ts
import * as fs6 from "node:fs";
import * as os4 from "node:os";
import * as fsPath from "node:path";

// src/scripts/_lib/fs_atomic.ts
import fs5 from "node:fs";
import path5 from "node:path";
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
  const target = path5.normalize(p);
  const parent = path5.dirname(target);
  fs5.mkdirSync(parent, { recursive: true });
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
    tmp_path = path5.join(
      parent,
      `.${path5.basename(target)}.tmp.${randomBytes3(6).toString("hex")}`
    );
    try {
      fd = fs5.openSync(tmp_path, "wx", 384);
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
      offset += fs5.writeSync(fd, payload, offset, payload.length - offset);
    }
    try {
      fs5.fsyncSync(fd);
    } catch {
    }
    fs5.closeSync(fd);
    closed = true;
    fs5.renameSync(tmp_path, target);
  } catch (err) {
    if (!closed) {
      try {
        fs5.closeSync(fd);
      } catch {
      }
    }
    try {
      fs5.unlinkSync(tmp_path);
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
    dir_fd = fs5.openSync(directory, fs5.constants.O_RDONLY);
  } catch {
    return;
  }
  try {
    try {
      fs5.fsyncSync(dir_fd);
    } catch {
    }
  } finally {
    fs5.closeSync(dir_fd);
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
function read_manifest(path11) {
  let text;
  try {
    text = require_read_text(path11);
  } catch {
    return null;
  }
  const data = _parse_manual(text);
  return _normalise_v2_shape(data);
}
function require_read_text(path11) {
  return fs6.readFileSync(path11, { encoding: "utf-8" });
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
function write_manifest(path11, version, tools, options = {}) {
  const rendered = _render2(version, tools, { deploy_roots: options.deploy_roots ?? null });
  return write_atomic(path11, rendered);
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

// src/scripts/_lib/claude_desktop_bundler.ts
import * as crypto from "node:crypto";
import * as fs7 from "node:fs";
import * as path6 from "node:path";

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
    return fs7.statSync(p).isDirectory();
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
  const resolved = fs7.realpathSync(skill_dir);
  const walk = (root, relRoot) => {
    const dirNames = [];
    const fileNames = [];
    for (const dirent of fs7.readdirSync(root, { withFileTypes: true })) {
      const full = path6.join(root, dirent.name);
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
      out.push([path6.join(root, fname), rel_parts]);
    }
    for (const dname of dirNames) {
      if (_is_excluded([dname])) {
        continue;
      }
      walk(path6.join(root, dname), [...relRoot, dname]);
    }
  };
  walk(resolved, []);
  out.sort((x, y) => _compare_rel_parts(x[1], y[1]));
  return out;
}
function _manifest_digest(files) {
  const h = crypto.createHash("sha256");
  for (const [abs_path, rel_parts] of files) {
    const rel = rel_parts.join("/");
    h.update(Buffer.from(rel, "utf-8"));
    h.update(Buffer.from([0]));
    h.update(crypto.createHash("sha256").update(fs7.readFileSync(abs_path)).digest());
    h.update(Buffer.from([0]));
  }
  return h.digest("hex");
}
function _atomic_write_zip(zip_path, files) {
  fs7.mkdirSync(path6.dirname(zip_path), { recursive: true });
  const stem = path6.basename(zip_path, path6.extname(zip_path));
  const tmp_path = path6.join(
    path6.dirname(zip_path),
    `.${stem}.${crypto.randomBytes(6).toString("hex")}.zip.tmp`
  );
  try {
    const entries = files.map(([abs_path, rel_parts]) => ({
      name: rel_parts.join("/"),
      data: fs7.readFileSync(abs_path)
    }));
    fs7.writeFileSync(tmp_path, zip_write_sync(entries));
    fs7.renameSync(tmp_path, zip_path);
  } finally {
    if (fs7.existsSync(tmp_path)) {
      fs7.unlinkSync(tmp_path);
    }
  }
}
function _write_if_changed(dest_dir, slug, files, force, written) {
  const digest = _manifest_digest(files);
  const zip_path = path6.join(dest_dir, `${slug}.zip`);
  const digest_path = path6.join(dest_dir, `${slug}.sha256`);
  const recorded = fs7.existsSync(digest_path) ? fs7.readFileSync(digest_path, "utf-8").trim() : "";
  if (!force && recorded === digest && fs7.existsSync(zip_path)) {
    return;
  }
  _atomic_write_zip(zip_path, files);
  fs7.writeFileSync(digest_path, digest + "\n", "utf-8");
  written.push(zip_path);
}
function build_skill_bundles(package_root, dest_dir, force = false, curation = null) {
  const skills_root = path6.join(package_root, "dist/agent-src", "skills");
  if (!_is_dir(skills_root)) {
    return [];
  }
  fs7.mkdirSync(dest_dir, { recursive: true });
  const written = [];
  for (const name of fs7.readdirSync(skills_root).sort()) {
    const entry = path6.join(skills_root, name);
    const isSymlink2 = fs7.lstatSync(entry).isSymbolicLink();
    if (!(_is_dir(entry) || isSymlink2)) {
      continue;
    }
    const skill_name = name;
    if (curation !== null && !curation.includes(skill_name)) {
      continue;
    }
    const skill_md = path6.join(entry, "SKILL.md");
    if (!fs7.existsSync(skill_md)) {
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
  const rel = path6.relative(commands_root, source_file);
  const noExt = rel.slice(0, rel.length - path6.extname(rel).length);
  return noExt.split(path6.sep).join("-");
}
function _iter_command_files(commands_root) {
  const found = [];
  const walk = (dir) => {
    for (const dirent of fs7.readdirSync(dir, { withFileTypes: true })) {
      const full = path6.join(dir, dirent.name);
      if (dirent.isDirectory() || dirent.isSymbolicLink() && _is_dir(full)) {
        walk(full);
      } else if (dirent.name.endsWith(".md")) {
        found.push(full);
      }
    }
  };
  walk(commands_root);
  found.sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  return found.filter((source_file) => path6.basename(source_file) !== "AGENTS.md");
}
function build_command_bundles(package_root, dest_dir, force = false, curation = null) {
  const commands_root = path6.join(package_root, "dist/agent-src", "commands");
  if (!_is_dir(commands_root)) {
    return [];
  }
  const skills_root = path6.join(package_root, "dist/agent-src", "skills");
  let skill_names = /* @__PURE__ */ new Set();
  if (_is_dir(skills_root)) {
    skill_names = new Set(
      fs7.readdirSync(skills_root).filter((name) => _is_dir(path6.join(skills_root, name)))
    );
  }
  fs7.mkdirSync(dest_dir, { recursive: true });
  const written = [];
  for (const source_file of _iter_command_files(commands_root)) {
    const slug = _command_slug(source_file, commands_root);
    if (skill_names.has(slug)) {
      continue;
    }
    if (curation !== null && !curation.includes(slug)) {
      continue;
    }
    const files = [[fs7.realpathSync(source_file), ["SKILL.md"]]];
    _write_if_changed(dest_dir, slug, files, force, written);
  }
  return written;
}

// src/scripts/_lib/agent_settings.ts
import { createRequire } from "node:module";
import * as fs8 from "node:fs";
import * as os5 from "node:os";
import * as path7 from "node:path";
var _require = createRequire(import.meta.url);
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
  return path7.join(project_root, ...LOCAL_PROJECT_SUBDIR, LOCAL_PROJECT_FILE);
}
function _canonical_settings_path(project_root) {
  return path7.join(project_root, ...LOCAL_PROJECT_SUBDIR, DEFAULT_PROJECT_FILE);
}
var USER_GLOBAL_FILENAME = "agent-settings.yml";
function DEFAULT_USER_GLOBAL_FILE() {
  return write_target(USER_GLOBAL_FILENAME);
}
function _resolve_user_global_file() {
  const found = resolve_with_fallback(USER_GLOBAL_FILENAME);
  if (found !== null) {
    return found;
  }
  return DEFAULT_USER_GLOBAL_FILE();
}
var MERGEABLE_KEYS = [
  "name",
  "ide",
  "rule_loading_tier",
  "memory.cadence",
  "personal.bot_icon",
  "personal.autonomy",
  "telegraph.speak_scope",
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
var _DEFAULTS = {};
var ANCHOR_AGENT_SETTINGS = "agent-settings";
var ANCHOR_AGENTS_DIR = "agents-dir";
var ANCHOR_GIT = "git";
var _AGENTS_DIR_MARKERS = [
  "roadmaps",
  "settings/.ai-council.yml",
  "roadmaps-progress.md",
  ".event4u-bridge.yml"
];
var _LEGACY_ANCHOR_ENV = "AGENT_CONFIG_LEGACY_ANCHOR";
function _exists(p) {
  try {
    fs8.lstatSync(p);
    fs8.statSync(p);
    return true;
  } catch {
    return false;
  }
}
function _is_dir2(p) {
  try {
    return fs8.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
function _is_file(p) {
  try {
    return fs8.statSync(p).isFile();
  } catch {
    return false;
  }
}
function _resolve(p) {
  const absolute = path7.resolve(p);
  try {
    return fs8.realpathSync(absolute);
  } catch {
    return absolute;
  }
}
function _ancestor_chain(start) {
  const chain = [];
  let cursor = start;
  for (; ; ) {
    chain.push(cursor);
    const parent = path7.dirname(cursor);
    if (parent === cursor) {
      break;
    }
    cursor = parent;
  }
  return chain;
}
function _boundary_anchor_at(dir) {
  const agents_dir = path7.join(dir, "agents");
  if (_is_dir2(agents_dir)) {
    for (const marker of _AGENTS_DIR_MARKERS) {
      if (_exists(path7.join(agents_dir, marker))) {
        return ANCHOR_AGENTS_DIR;
      }
    }
  }
  if (_exists(path7.join(dir, ".git"))) {
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
      if (_exists(path7.join(candidate, ".git"))) {
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
    if (_exists(path7.join(candidate, DEFAULT_PROJECT_FILE))) {
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
    return os5.homedir();
  }
  if (p.startsWith("~/") || process.platform === "win32" && p.startsWith("~\\")) {
    return path7.join(os5.homedir(), p.slice(2));
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
    const parent = path7.dirname(legacy);
    return [legacy, _canonical_settings_path(parent), _local_settings_path(parent)];
  }
  const root = find_project_root(cwd);
  if (root === null) {
    const legacy = project_path ? project_path : DEFAULT_PROJECT_FILE;
    const parent = path7.dirname(legacy);
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
    const parent = path7.dirname(cursor);
    if (parent === cursor) {
      break;
    }
    cursor = parent;
  }
  chain.reverse();
  return [
    ...chain.map((d) => path7.join(d, DEFAULT_PROJECT_FILE)),
    _canonical_settings_path(root),
    _local_settings_path(root)
  ];
}
function load_agent_settings(options = {}) {
  const project_path = options.project_path ?? null;
  const user_global_path = options.user_global_path ?? null;
  const verbose = options.verbose ?? false;
  const cwd = options.cwd ?? null;
  const user_global_raw = _read_yaml(user_global_path ? user_global_path : _resolve_user_global_file()) ?? {};
  const [user_global_filtered, ignored] = _filter_whitelist(user_global_raw, MERGEABLE_KEYS);
  if (verbose && ignored.length > 0) {
    logger.info(
      "agent_settings: ignored non-whitelisted user-global keys: %s",
      [...ignored].sort()
    );
  }
  const cascade = _resolve_cascade_paths(cwd, project_path);
  const merged = _deep_copy_defaults(_DEFAULTS);
  _deep_merge(merged, user_global_filtered);
  for (const p of cascade) {
    const layer = _read_yaml(p) ?? {};
    if (Object.keys(layer).length > 0) {
      _deep_merge(merged, layer);
    }
  }
  return merged;
}
function _read_yaml(p) {
  if (!_is_file(p)) {
    return null;
  }
  let YAML;
  try {
    YAML = _require("yaml");
  } catch {
    return null;
  }
  let data;
  try {
    const text = fs8.readFileSync(p, "utf-8");
    data = YAML.parse(text, { version: "1.1" });
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
function _deep_copy_defaults(src) {
  const out = {};
  _deep_merge(out, src);
  return out;
}
function _is_plain_dict(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// src/scripts/_lib/module_detection.ts
import * as fs9 from "node:fs";
import * as path8 from "node:path";
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
    return fs9.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
function _isFile(p) {
  try {
    return fs9.statSync(p).isFile();
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
    entries = fs9.readdirSync(root).sort();
  } catch {
    return [];
  }
  const out = [];
  for (const name of entries) {
    if (!_isDir(path8.join(root, name))) {
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
    const withPkgJson = subdirs.filter((name) => _isFile(path8.join(root, name, "package.json")));
    return withPkgJson.length > 0 ? "high" : "medium";
  }
  if (stack === "python-src") {
    const withInit = subdirs.filter((name) => _isFile(path8.join(root, name, "__init__.py")));
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
    const abs_path = path8.join(project_root, rel_path);
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
import fs10 from "node:fs";
var TIER_TO_CLAUDE_MODEL = {
  high: "opus",
  medium: "sonnet",
  lite: "haiku"
};
var MODEL_TIER_RE = /^model_tier:\s*"?([a-z]+)"?\s*$/m;
function read_model_tier(skill_md) {
  if (!fs10.existsSync(skill_md)) return null;
  const text = fs10.readFileSync(skill_md).toString("utf-8");
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
import * as fs11 from "node:fs";
import * as path9 from "node:path";
import process2 from "node:process";
import { fileURLToPath as fileURLToPath2, pathToFileURL } from "node:url";
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
var _HERE_DIR = path9.dirname(fileURLToPath2(import.meta.url));
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
    return fs11.statSync(p).isFile();
  } catch {
    return false;
  }
}
function _isDir2(p) {
  try {
    return fs11.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
function _isSymlink(p) {
  try {
    return fs11.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}
function _exists2(p) {
  try {
    fs11.lstatSync(p);
    return true;
  } catch {
    return false;
  }
}
function _readText(p) {
  return fs11.readFileSync(p, { encoding: "utf-8" });
}
function _writeText(p, text) {
  fs11.writeFileSync(p, text, { encoding: "utf-8" });
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
    target = fs11.readlinkSync(link);
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
  return _isFile2(path9.join(project, LEGACY_STATE_FILENAME));
}
function _detect_legacy_settings(project) {
  const found = [];
  for (const name of LEGACY_SETTINGS_FILES) {
    const flat = path9.join(project, name);
    if (_isFile2(flat)) {
      found.push(flat);
    }
    const typed = path9.join(project, "settings", name);
    if (_isFile2(typed)) {
      found.push(typed);
    }
  }
  return found;
}
function _detect_empty_shell(project) {
  const shell = path9.join(project, LEGACY_AGENT_CONFIG_SHELL);
  if (!_isDir2(shell) || _isSymlink(shell)) {
    return false;
  }
  try {
    return fs11.readdirSync(shell).length === 0;
  } catch {
    return false;
  }
}
function _detect_already_migrated(project) {
  if (_detect_npm(path9.join(project, "package.json"))) {
    return false;
  }
  if (_detect_composer(path9.join(project, "composer.json"))) {
    return false;
  }
  for (const name of MANAGED_SYMLINKS) {
    if (_classify_symlink(path9.join(project, name)) === "legacy") {
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
    const link = path9.join(project, name);
    const kind = _classify_symlink(link);
    if (kind === "legacy") {
      try {
        fs11.unlinkSync(link);
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
  const source = path9.join(project, LEGACY_STATE_FILENAME);
  if (!_isFile2(source)) {
    return null;
  }
  const target = path9.join(project, LEGACY_STATE_V1_FILENAME);
  if (_exists2(target)) {
    try {
      fs11.unlinkSync(source);
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
  const pkg_root = path9.resolve(_HERE_DIR, "..", "..", "..");
  const rel = path9.join(
    "agent-src",
    "templates",
    "scripts",
    "work_engine",
    "migration",
    "v0_to_v1.ts"
  );
  const driver = [path9.join(pkg_root, "dist", rel), path9.join(pkg_root, "src", rel)].find(
    (p) => fs11.existsSync(p)
  ) ?? null;
  if (driver === null) {
    return null;
  }
  const binName = process2.platform === "win32" ? "tsx.cmd" : "tsx";
  let tsxBin = null;
  for (let dir = pkg_root; ; ) {
    const cand = path9.join(dir, "node_modules", ".bin", binName);
    if (fs11.existsSync(cand)) {
      tsxBin = cand;
      break;
    }
    const parent = path9.dirname(dir);
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
      fs11.unlinkSync(p);
      removed.push(path9.relative(project, p));
    } catch {
      continue;
    }
  }
  const settings_dir = path9.join(project, "settings");
  if (_isDir2(settings_dir) && !_isSymlink(settings_dir)) {
    try {
      if (fs11.readdirSync(settings_dir).length === 0) {
        fs11.rmdirSync(settings_dir);
        removed.push("settings/");
      }
    } catch {
    }
  }
  return removed;
}
function _remove_empty_shell(project) {
  const shell = path9.join(project, LEGACY_AGENT_CONFIG_SHELL);
  if (!_detect_empty_shell(project)) {
    return false;
  }
  try {
    fs11.rmdirSync(shell);
  } catch {
    return false;
  }
  return true;
}
function _reEscape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function _update_gitignore(project) {
  const gitignore = path9.join(project, ".gitignore");
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
    npm: _detect_npm(path9.join(project, "package.json")),
    composer: _detect_composer(path9.join(project, "composer.json")),
    symlinks_legacy: MANAGED_SYMLINKS.filter(
      (name) => _classify_symlink(path9.join(project, name)) === "legacy"
    ),
    symlinks_user: MANAGED_SYMLINKS.filter(
      (name) => _classify_symlink(path9.join(project, name)) === "user"
    ),
    state_file: _isFile2(path9.join(project, LEGACY_STATE_FILENAME)),
    settings_files: _detect_legacy_settings(project).map((p) => path9.relative(project, p)),
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
  if (_strip_npm_entry(path9.join(project, "package.json"))) {
    summary.push(`removed ${PACKAGE_NAME_NPM} from package.json`);
  }
  if (_strip_composer_entry(path9.join(project, "composer.json"))) {
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
var _bundled = true;
var _HERE = fileURLToPath2(import.meta.url);
var _isCliEntry = process2.argv[1] !== void 0 && import.meta.url === pathToFileURL(path9.resolve(process2.argv[1])).href;
if (!_bundled && (_isCliEntry || process2.argv[1] === _HERE)) {
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
var _HERE2 = fileURLToPath3(import.meta.url);
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
function expanduser5(p) {
  if (p === "~") return os6.homedir();
  if (p.startsWith("~/") || p.startsWith("~\\")) {
    return path10.join(os6.homedir(), p.slice(2));
  }
  return p;
}
function resolvePath(p) {
  try {
    return fs12.realpathSync(path10.resolve(p));
  } catch {
    return path10.resolve(p);
  }
}
function isFile(p) {
  try {
    return fs12.statSync(p).isFile();
  } catch {
    return false;
  }
}
function isDir(p) {
  try {
    return fs12.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
function pathExists(p) {
  try {
    fs12.statSync(p);
    return true;
  } catch {
    return false;
  }
}
function isSymlink(p) {
  try {
    return fs12.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}
function readText(p) {
  return fs12.readFileSync(p, "utf-8");
}
function writeText(p, content) {
  fs12.writeFileSync(p, content, "utf-8");
}
function mkdirp(p) {
  fs12.mkdirSync(p, { recursive: true });
}
function sortedGlobStems(directory, suffix) {
  let entries;
  try {
    entries = fs12.readdirSync(directory);
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
  for (const name of fs12.readdirSync(directory)) {
    if (name.endsWith(".zip")) n += 1;
  }
  return n;
}
function sha256OfFile(p) {
  let data;
  try {
    data = fs12.readFileSync(p);
  } catch {
    return null;
  }
  return crypto2.createHash("sha256").update(data).digest("hex");
}
function atomicWrite0644(target, body, prefix) {
  const dir = path10.dirname(target);
  const tmpName = path10.join(
    dir,
    `${prefix}${process3.pid}.${crypto2.randomBytes(6).toString("hex")}.yml.tmp`
  );
  let fd = null;
  try {
    fd = fs12.openSync(tmpName, "wx", 420);
    fs12.writeFileSync(fd, body, "utf-8");
    fs12.closeSync(fd);
    fd = null;
    fs12.chmodSync(tmpName, 420);
    fs12.renameSync(tmpName, target);
  } catch (err) {
    if (fd !== null) {
      try {
        fs12.closeSync(fd);
      } catch {
      }
    }
    try {
      fs12.unlinkSync(tmpName);
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
  return path10.join(project_root, ...SETTINGS_SUBDIR, SETTINGS_FILE);
}
function _resolve_settings_read(project_root) {
  const canonical = _canonical_settings_target(project_root);
  if (pathExists(canonical)) return canonical;
  const legacy = path10.join(project_root, SETTINGS_FILE);
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
  const npm_path = path10.join(project_root, "node_modules", "@event4u", "agent-config");
  if (isDir(npm_path)) return resolvePath(npm_path);
  if (pathExists(path10.join(project_root, "src", "config", "profiles", "minimal.ini"))) {
    return project_root;
  }
  fail(
    "Could not find agent-config package. Install via `npx @event4u/agent-config init` or `npm install -g @event4u/agent-config`."
  );
}
function detect_package_type(package_root) {
  if (package_root.split(path10.sep).includes("node_modules")) return "npm";
  return "local";
}
function detect_package_type_for_project(project_root, package_root) {
  const npm_path = resolvePath(
    path10.join(project_root, "node_modules", "@event4u", "agent-config")
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
  ensure_directory(path10.dirname(p));
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
  const legacy_target = path10.join(project_root, LEGACY_SETTINGS_FILE);
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
  const backup_target = path10.join(project_root, LEGACY_BACKUP_FILE);
  writeText(backup_target, legacy_text);
  fs12.unlinkSync(legacy_target);
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
  const directory = path10.join(package_root, USER_TYPES_DIR);
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
  const profile_source = path10.join(package_root, "src", "config", "profiles", `${profile}.ini`);
  const template_source = path10.join(package_root, "src", "config", "agent-settings.template.yml");
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
      `Profile preset ${path10.basename(profile_source)} has rule_loading_tier=${got} but --profile=${profile}`
    );
  }
  profile_values["user_type"] = _validate_user_type(package_root, user_type);
  let template_body = _render_template(template, profile_values);
  template_body = _inject_packs(template_body, packs ?? []);
  const legacy_root = path10.join(project_root, SETTINGS_FILE);
  if (isFile(legacy_root) && !pathExists(target)) {
    mkdirp(path10.dirname(target));
    writeText(target, readText(legacy_root));
    fs12.unlinkSync(legacy_root);
    success(`Migrated ${SETTINGS_FILE} \u2192 agents/settings/${SETTINGS_FILE} (ADR-038)`);
    return;
  }
  const legacy_target = path10.join(project_root, LEGACY_SETTINGS_FILE);
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
  mkdirp(path10.dirname(target));
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
  merge_json_file(
    path10.join(project_root, ".vscode", "settings.json"),
    bridge,
    force,
    ".vscode/settings.json"
  );
}
function ensure_augment_bridge(project_root, force) {
  const bridge = { enabledPlugins: { "agent-config@event4u": true } };
  return merge_json_file(
    path10.join(project_root, ".augment", "settings.json"),
    bridge,
    force,
    ".augment/settings.json"
  );
}
var AUGMENT_USER_DIR = path10.join(os6.homedir(), ".augment");
var AUGMENT_USER_HOOKS_DIR = path10.join(AUGMENT_USER_DIR, "hooks");
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
  const src = path10.join(package_root, "scripts", "hooks", name);
  if (!pathExists(src)) {
    skip(`augment trampoline missing in package: ${src}`);
    return null;
  }
  mkdirp(AUGMENT_USER_HOOKS_DIR);
  const dst = path10.join(AUGMENT_USER_HOOKS_DIR, name);
  const src_text = readText(src);
  if (pathExists(dst) && readText(dst) === src_text && !force) {
    skip(`~/.augment/hooks/${name} already up to date`);
  } else {
    writeText(dst, src_text);
    fs12.chmodSync(dst, 493);
    success(`~/.augment/hooks/${name} installed`);
  }
  return dst;
}
function _remove_legacy_augment_trampolines() {
  for (const name of AUGMENT_LEGACY_TRAMPOLINES) {
    const legacy = path10.join(AUGMENT_USER_HOOKS_DIR, name);
    try {
      if (isFile(legacy)) {
        fs12.unlinkSync(legacy);
        skip(`removed legacy ~/.augment/hooks/${name}`);
      }
    } catch {
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
    path10.join(AUGMENT_USER_DIR, "settings.json"),
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
  const target = path10.join(project_root, ".claude", "settings.json");
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
  return `./agent-config dispatch:hook --platform cursor --event ${ac_event} --native-event ${native}`;
}
function ensure_cursor_bridge(project_root, force) {
  const hooks = {};
  for (const [ac_event, native] of CURSOR_DISPATCHER_BINDINGS) {
    (hooks[native] ??= []).push({ command: _cursor_dispatch_command(ac_event, native) });
  }
  const bridge = { version: 1, hooks };
  return merge_json_file(
    path10.join(project_root, ".cursor", "hooks.json"),
    bridge,
    force,
    ".cursor/hooks.json"
  );
}
var CURSOR_USER_DIR = path10.join(os6.homedir(), ".cursor");
var CURSOR_USER_HOOKS_DIR = path10.join(CURSOR_USER_DIR, "hooks");
var CURSOR_DISPATCHER_TRAMPOLINE = "cursor-dispatcher.sh";
function ensure_cursor_user_hooks(package_root, force) {
  const src = path10.join(package_root, "scripts", "hooks", CURSOR_DISPATCHER_TRAMPOLINE);
  if (!pathExists(src)) {
    skip(`cursor trampoline missing in package: ${src}`);
    return [];
  }
  mkdirp(CURSOR_USER_HOOKS_DIR);
  const dst = path10.join(CURSOR_USER_HOOKS_DIR, CURSOR_DISPATCHER_TRAMPOLINE);
  const src_text = readText(src);
  if (pathExists(dst) && readText(dst) === src_text && !force) {
    skip(`~/.cursor/hooks/${CURSOR_DISPATCHER_TRAMPOLINE} already up to date`);
  } else {
    writeText(dst, src_text);
    fs12.chmodSync(dst, 493);
    success(`~/.cursor/hooks/${CURSOR_DISPATCHER_TRAMPOLINE} installed`);
  }
  const hooks = {};
  for (const [ac_event, native] of CURSOR_DISPATCHER_BINDINGS) {
    (hooks[native] ??= []).push({ command: `${dst} ${ac_event} ${native}` });
  }
  const settings_patch = { version: 1, hooks };
  return merge_json_file(
    path10.join(CURSOR_USER_DIR, "hooks.json"),
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
  const hooks_dir = path10.join(project_root, ".clinerules", "hooks");
  mkdirp(hooks_dir);
  const workspace_quoted = shlexQuote(resolvePath(project_root));
  let written = 0;
  for (const [ac_event, native_event] of CLINE_DISPATCHER_BINDINGS) {
    const target = path10.join(hooks_dir, native_event);
    const body = clineProjectHookBody(native_event, ac_event, workspace_quoted);
    if (pathExists(target) && readText(target) === body && !force) {
      continue;
    }
    if (pathExists(target) && !force) {
      skip(`.clinerules/hooks/${native_event} exists, needs update (use --force)`);
      continue;
    }
    writeText(target, body);
    fs12.chmodSync(target, 493);
    written += 1;
  }
  if (written) {
    success(`.clinerules/hooks/ \u2014 ${written} script(s) installed`);
  } else {
    skip(".clinerules/hooks/ already up to date");
  }
}
var CLINE_USER_DIR = path10.join(os6.homedir(), "Documents", "Cline", "Hooks");
var CLINE_DISPATCHER_TRAMPOLINE = "cline-dispatcher.sh";
function ensure_cline_user_hooks(package_root, force) {
  const src = path10.join(package_root, "scripts", "hooks", CLINE_DISPATCHER_TRAMPOLINE);
  if (!pathExists(src)) {
    skip(`cline trampoline missing in package: ${src}`);
    return;
  }
  mkdirp(CLINE_USER_DIR);
  const trampoline = path10.join(CLINE_USER_DIR, CLINE_DISPATCHER_TRAMPOLINE);
  const src_text = readText(src);
  if (pathExists(trampoline) && readText(trampoline) === src_text && !force) {
    skip(`~/Documents/Cline/Hooks/${CLINE_DISPATCHER_TRAMPOLINE} already up to date`);
  } else {
    writeText(trampoline, src_text);
    fs12.chmodSync(trampoline, 493);
    success(`~/Documents/Cline/Hooks/${CLINE_DISPATCHER_TRAMPOLINE} installed`);
  }
  const trampoline_quoted = shlexQuote(trampoline);
  for (const [ac_event, native_event] of CLINE_DISPATCHER_BINDINGS) {
    const wrapper = path10.join(CLINE_USER_DIR, native_event);
    const body = `#!/usr/bin/env bash
# Generated by event4u/agent-config install.py \u2014 DO NOT EDIT.
# User-scope Cline hook for ${native_event} \u2192 agent-config ${ac_event}.
exec ${trampoline_quoted} ${ac_event} ${native_event}
`;
    if (pathExists(wrapper) && readText(wrapper) === body && !force) {
      continue;
    }
    writeText(wrapper, body);
    fs12.chmodSync(wrapper, 493);
  }
}
var WINDSURF_DISPATCHER_BINDINGS = [
  ["session_start", "post_setup_worktree"],
  ["user_prompt_submit", "pre_user_prompt"],
  ["stop", "post_cascade_response"]
];
function _windsurf_dispatch_command(ac_event, native) {
  return `./agent-config dispatch:hook --platform windsurf --event ${ac_event} --native-event ${native}`;
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
    path10.join(project_root, ".windsurf", "hooks.json"),
    bridge,
    force,
    ".windsurf/hooks.json"
  );
}
var WINDSURF_USER_DIR = path10.join(os6.homedir(), ".codeium", "windsurf");
var WINDSURF_USER_HOOKS_DIR = path10.join(WINDSURF_USER_DIR, "hooks");
var WINDSURF_DISPATCHER_TRAMPOLINE = "windsurf-dispatcher.sh";
function ensure_windsurf_user_hooks(package_root, force) {
  const src = path10.join(package_root, "scripts", "hooks", WINDSURF_DISPATCHER_TRAMPOLINE);
  if (!pathExists(src)) {
    skip(`windsurf trampoline missing in package: ${src}`);
    return [];
  }
  mkdirp(WINDSURF_USER_HOOKS_DIR);
  const dst = path10.join(WINDSURF_USER_HOOKS_DIR, WINDSURF_DISPATCHER_TRAMPOLINE);
  const src_text = readText(src);
  if (pathExists(dst) && readText(dst) === src_text && !force) {
    skip(`~/.codeium/windsurf/hooks/${WINDSURF_DISPATCHER_TRAMPOLINE} already up to date`);
  } else {
    writeText(dst, src_text);
    fs12.chmodSync(dst, 493);
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
    path10.join(WINDSURF_USER_DIR, "hooks.json"),
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
  return `./agent-config dispatch:hook --platform gemini --event ${ac_event} --native-event ${native}`;
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
    path10.join(project_root, ".gemini", "settings.json"),
    bridge,
    force,
    ".gemini/settings.json"
  );
}
var GEMINI_USER_DIR = path10.join(os6.homedir(), ".gemini");
var GEMINI_USER_HOOKS_DIR = path10.join(GEMINI_USER_DIR, "hooks");
var GEMINI_DISPATCHER_TRAMPOLINE = "gemini-dispatcher.sh";
function ensure_gemini_user_hooks(package_root, force) {
  const src = path10.join(package_root, "scripts", "hooks", GEMINI_DISPATCHER_TRAMPOLINE);
  if (!pathExists(src)) {
    skip(`gemini trampoline missing in package: ${src}`);
    return [];
  }
  mkdirp(GEMINI_USER_HOOKS_DIR);
  const dst = path10.join(GEMINI_USER_HOOKS_DIR, GEMINI_DISPATCHER_TRAMPOLINE);
  const src_text = readText(src);
  if (pathExists(dst) && readText(dst) === src_text && !force) {
    skip(`~/.gemini/hooks/${GEMINI_DISPATCHER_TRAMPOLINE} already up to date`);
  } else {
    writeText(dst, src_text);
    fs12.chmodSync(dst, 493);
    success(`~/.gemini/hooks/${GEMINI_DISPATCHER_TRAMPOLINE} installed`);
  }
  const settings_patch = {
    hooks: _gemini_hooks_dict((ac_event, native) => `${dst} ${ac_event} ${native}`)
  };
  return merge_json_file(
    path10.join(GEMINI_USER_DIR, "settings.json"),
    settings_patch,
    force,
    "~/.gemini/settings.json"
  );
}
function ensure_copilot_bridge(project_root, force) {
  const target = path10.join(project_root, ".github", "plugin", "marketplace.json");
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
  const target = path10.join(project_root, ".roo", "rules", "agent-config.md");
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
  const target = path10.join(project_root, ".claude-desktop", "agent-config.md");
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
  const target = path10.join(project_root, ".aider", "agent-config.md");
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
  const target = path10.join(project_root, ".codex", "agent-config.md");
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
  const target = path10.join(project_root, ".continue", "rules", "agent-config.md");
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
  const target = path10.join(project_root, ".kilocode", "rules", "agent-config.md");
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
  const target = path10.join(project_root, ".zed", "agent-config.md");
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
  const target = path10.join(project_root, ".jetbrains", "agent-config.md");
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
  const target = path10.join(project_root, ".kiro", "steering", "agent-config.md");
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
    return fs12.readdirSync(p).length > 0;
  } catch {
    return false;
  }
}
function _resolve_tsx_invocation(scriptPath, scriptArgs) {
  const binName = process3.platform === "win32" ? "tsx.cmd" : "tsx";
  let dir = path10.dirname(scriptPath);
  for (; ; ) {
    const candidate = path10.join(dir, "node_modules", ".bin", binName);
    if (isFile(candidate)) {
      return { command: candidate, args: [scriptPath, ...scriptArgs] };
    }
    const parent = path10.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return { command: "npx", args: ["tsx", scriptPath, ...scriptArgs] };
}
function _smoke_test_hooks(project_root, package_root) {
  const dispatcher = path10.join(package_root, "scripts", "hooks", "dispatch_hook.ts");
  const manifest = path10.join(package_root, "scripts", "hook_manifest.yaml");
  if (!isFile(dispatcher) || !isFile(manifest)) return 0;
  const failed = [];
  const skipped = [];
  const passed = [];
  for (const [platform, native] of SMOKE_PROBE_EVENTS) {
    const rel_bridge = SMOKE_BRIDGE_PATHS[platform] ?? "";
    const bridge_path = rel_bridge ? path10.join(project_root, rel_bridge) : null;
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
var GLOBAL_ROOT = path10.join(os6.homedir(), ".event4u", "agent-config");
var GLOBAL_USER_SETTINGS_PATH = path10.join(GLOBAL_ROOT, ".agent-user.yml");
var GLOBAL_AGENT_SETTINGS_PATH = path10.join(GLOBAL_ROOT, ".agent-settings.yml");
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
    cp = resolvePath(expanduser5(raw));
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
  const has_manifest = SCOPE_DETECT_MANIFESTS.find((m) => pathExists(path10.join(cwd, m))) ?? null;
  const has_ai_dir = SCOPE_DETECT_AI_DIRS.find((d) => isDir(path10.join(cwd, d))) ?? null;
  const has_ai_file = SCOPE_DETECT_AI_FILES.find((f) => pathExists(path10.join(cwd, f))) ?? null;
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
      n = fs12.readSync(0, buf, 0, 1, null);
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
    if (!path10.isAbsolute(marker_path)) {
      marker_path = path10.join(project_root, marker_path);
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
    const rel = isRelativeTo(target, project_root) ? path10.relative(project_root, target) : target;
    info(`Manifest updated: ${rel}`);
  }
  return 0;
}
function isRelativeTo(child, parent) {
  const rel = path10.relative(parent, child);
  return rel === "" || !rel.startsWith("..") && !path10.isAbsolute(rel);
}
function _resolve_package_root_for_global() {
  const here = resolvePath(_HERE2);
  const candidate = path10.dirname(path10.dirname(path10.dirname(here)));
  if (!pathExists(path10.join(candidate, "src", "config", "profiles", "minimal.ini"))) {
    fail(
      `Could not locate agent-config package root from ${here}. Expected src/config/profiles/minimal.ini at the parent directory.`
    );
  }
  return candidate;
}
var CONSUMER_BRIDGE_MARKER_RELPATH = path10.join("agents", ".event4u-bridge.yml");
var MIGRATE_LEGACY_YAML_FILES = [".agent-settings.yml", ".agent-user.yml"];
var MIGRATE_LEGACY_TOOL_DIRS = [".augment", ".claude", ".cursor"];
var AGENT_CONFIG_PACKAGE_NAME = "@event4u/agent-config";
function _is_agent_config_source_repo(project_root) {
  if (process3.env["AGENT_CONFIG_CONSUMER_MODE"] === "1") {
    return [false, "consumer-mode-override"];
  }
  const pkg_json = path10.join(project_root, "package.json");
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
  if (isDir(path10.join(project_root, ".agent-src.uncondensed"))) {
    return [true, ".agent-src.uncondensed/"];
  }
  const packages_dir = path10.join(project_root, "packages");
  if (isDir(packages_dir)) {
    for (const child of fs12.readdirSync(packages_dir)) {
      if (isDir(path10.join(packages_dir, child, ".agent-src.uncondensed"))) {
        return [true, `packages/${child}/.agent-src.uncondensed/`];
      }
    }
  }
  const installer_self = path10.join(project_root, "scripts", "install.py");
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
  if (isFile(path10.join(project_root, CONSUMER_BRIDGE_MARKER_RELPATH))) return [];
  const found = [];
  for (const name of MIGRATE_LEGACY_YAML_FILES) {
    if (isFile(path10.join(project_root, name))) {
      found.push(name);
    } else if (isFile(path10.join(project_root, "settings", name))) {
      found.push(`settings/${name}`);
    }
  }
  for (const name of MIGRATE_LEGACY_TOOL_DIRS) {
    const p = path10.join(project_root, name);
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
      info(`  ${path10.join(project_root, rel)}`);
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
  const home = resolvePath(os6.homedir());
  const resolved = resolvePath(global_root);
  const rel = path10.relative(home, resolved);
  if (rel === "" || rel.startsWith("..") || path10.isAbsolute(rel)) {
    return global_root;
  }
  return `~/${rel.split(path10.sep).join("/")}`;
}
function _write_consumer_bridge_marker(project_root, installer_version, env = null, now = null) {
  const env_map = env ?? process3.env;
  if (env_map["AGENT_CONFIG_DEV_MODE"] === "1") return null;
  if (isDir(path10.join(project_root, ".agent-src.uncondensed"))) return null;
  const global_root_str = _format_global_root_for_marker(
    event4u_root(env_map)
  );
  const stamp = utcStamp(now ?? void 0);
  const body = `# event4u/agent-config \u2014 consumer bridge marker (auto-written).
# Spec: docs/contracts/consumer-bridge.md (event4u-bridge/v1).
# Reader contract: expand ~ against the current $HOME; fail closed
# when global_root is missing on disk; never write back through it.
schema: event4u-bridge/v1
global_root: ${global_root_str}
installed_at: ${stamp}
installer_version: ${installer_version}
`;
  const target = path10.join(project_root, CONSUMER_BRIDGE_MARKER_RELPATH);
  mkdirp(path10.dirname(target));
  atomicWrite0644(target, body, ".event4u-bridge.");
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
  if (isDir(path10.join(project_root, ".agent-src.uncondensed"))) return [];
  const global_root_str = _format_global_root_for_marker(
    event4u_root(env_map)
  );
  const stamp = utcStamp(now ?? void 0);
  const written = [];
  for (const tool_id of Object.keys(PROJECT_ANCHOR_TOOLS).sort()) {
    const rel_path = PROJECT_ANCHOR_TOOLS[tool_id];
    if (!tools.has(tool_id)) continue;
    const target = path10.join(project_root, rel_path);
    mkdirp(path10.dirname(target));
    const bridge_abs = path10.join(project_root, CONSUMER_BRIDGE_MARKER_RELPATH);
    const bridge_rel = path10.relative(path10.dirname(target), bridge_abs);
    const body = `# event4u/agent-config \u2014 per-tool project anchor (auto-written).
# Spec: docs/contracts/consumer-bridge.md \xA7 Per-tool anchor strategy.
# Tool: ${tool_id}. Bridge marker: agents/.event4u-bridge.yml.
schema: event4u-bridge/v1
tool: ${tool_id}
bridge: ${bridge_rel}
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
  if (path10.extname(target) !== ".md") return;
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
      const rel = path10.relative(resolvePath(package_root), resolved_src);
      if (rel !== "" && !rel.startsWith("..") && !path10.isAbsolute(rel)) {
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
function _copy_dir_dereferencing_symlinks(src, dest, force, package_root = null) {
  let written = 0;
  let skipped = 0;
  const written_paths = [];
  if (!pathExists(src)) return [0, 0, written_paths];
  if (!isDir(src)) {
    mkdirp(path10.dirname(dest));
    const decision = _resolve_file_conflict(dest, force);
    if (decision === "skip") return [0, 1, written_paths];
    fs12.copyFileSync(src, dest);
    _inject_package_tag(dest, src, package_root);
    written_paths.push(dest);
    return [1, 0, written_paths];
  }
  mkdirp(dest);
  const walk = (node) => {
    const acc = [];
    const names = fs12.readdirSync(node).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
    for (const name of names) {
      const entry = path10.join(node, name);
      acc.push(entry);
      const lst = fs12.lstatSync(entry);
      if (lst.isDirectory() && !lst.isSymbolicLink()) {
        acc.push(...walk(entry));
      }
    }
    return acc;
  };
  for (const entry of walk(src)) {
    const rel = path10.relative(src, entry);
    const target = path10.join(dest, rel);
    const lst = fs12.lstatSync(entry);
    if (lst.isDirectory() && !lst.isSymbolicLink()) {
      mkdirp(target);
      continue;
    }
    let resolvedIsDir = false;
    let resolved = entry;
    try {
      resolved = fs12.realpathSync(entry);
      resolvedIsDir = fs12.statSync(entry).isDirectory();
    } catch {
      resolvedIsDir = false;
    }
    if (resolvedIsDir) {
      mkdirp(target);
      const [sub_w, sub_s, sub_p] = _copy_dir_dereferencing_symlinks(
        resolved,
        target,
        force,
        package_root
      );
      written += sub_w;
      skipped += sub_s;
      written_paths.push(...sub_p);
      continue;
    }
    const decision = _resolve_file_conflict(target, force);
    if (decision === "skip") {
      skipped += 1;
      continue;
    }
    mkdirp(path10.dirname(target));
    fs12.copyFileSync(resolved, target);
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
  const anchor = expanduser5(USER_SCOPE_PATHS["claude-desktop"]);
  const target = path10.join(anchor, "agent-config.md");
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
function _deploy_global_content(tools, force, package_root, lockfile_path2) {
  const results = {};
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
    const anchor = expanduser5(anchor_raw);
    let written_total = 0;
    let skipped_total = 0;
    const written_paths = [];
    let current_files = /* @__PURE__ */ new Set();
    for (const [src_rel, dest_sub] of plan) {
      const src = path10.join(package_root, src_rel);
      const dest = dest_sub ? path10.join(anchor, dest_sub) : anchor;
      const [w, s, paths] = _copy_dir_dereferencing_symlinks(src, dest, force, package_root);
      written_total += w;
      skipped_total += s;
      written_paths.push(...paths);
      current_files = setUnion(
        current_files,
        expected_deploy_files(src, dest_sub ? dest_sub : "")
      );
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
  for (const tool_id of [...tools].sort()) {
    const plan = GLOBAL_DEPLOY_SOURCES[tool_id];
    if (plan === void 0) continue;
    const anchor_raw = USER_SCOPE_PATHS[tool_id];
    if (!anchor_raw) continue;
    const anchor = expanduser5(anchor_raw);
    let current_files = /* @__PURE__ */ new Set();
    for (const [src_rel, dest_sub] of plan) {
      const src = path10.join(package_root, src_rel);
      current_files = setUnion(
        current_files,
        expected_deploy_files(src, dest_sub ? dest_sub : "")
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
    const target = dest_sub ? path10.join(anchor, dest_sub) : anchor;
    const label = dest_sub || ".";
    if (!isDir(target)) {
      missing.push(label);
      continue;
    }
    try {
      const entries = fs12.readdirSync(target);
      if (entries.length === 0) missing.push(label);
    } catch {
      missing.push(label);
    }
  }
  return missing;
}
function _prune_lab_modules(deploy_results, lab_ids) {
  let pruned = 0;
  const adjusted = {};
  for (const tool_id of Object.keys(deploy_results)) {
    const [written, skipped, status, paths] = deploy_results[tool_id];
    const lab_skill_dirs = /* @__PURE__ */ new Set();
    for (const p of paths) {
      const parts = p.split(path10.sep);
      if (parts.includes("skills")) {
        const i = parts.indexOf("skills");
        if (i + 1 < parts.length) {
          const skill_root = parts.slice(0, i + 2).join(path10.sep);
          if (!lab_skill_dirs.has(skill_root)) {
            const skillmd = path10.join(skill_root, "SKILL.md");
            if (pathExists(skillmd) && is_lab_artefact(skillmd, lab_ids)) {
              lab_skill_dirs.add(skill_root);
            }
          }
        }
      }
    }
    const keep = [];
    const delete_files = [];
    for (const p of paths) {
      const parts = p.split(path10.sep);
      let is_lab = false;
      if (parts.includes("skills")) {
        const i = parts.indexOf("skills");
        if (i + 1 < parts.length && lab_skill_dirs.has(parts.slice(0, i + 2).join(path10.sep))) {
          is_lab = true;
        }
      } else if (parts.includes("commands") && path10.extname(p) === ".md" && is_lab_artefact(p, lab_ids)) {
        is_lab = true;
      }
      (is_lab ? delete_files : keep).push(p);
    }
    for (const d of lab_skill_dirs) {
      fs12.rmSync(d, { recursive: true, force: true });
    }
    for (const p of delete_files) {
      if (p.split(path10.sep).includes("commands") && pathExists(p)) {
        try {
          fs12.unlinkSync(p);
        } catch {
        }
      }
    }
    pruned += delete_files.length;
    adjusted[tool_id] = [Math.max(0, written - delete_files.length), skipped, status, keep];
  }
  return [pruned, adjusted];
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
  const failed_tools = new Set(
    Object.keys(deploy_results).filter(
      (tool_id) => deploy_results[tool_id][2] === "deploy_failed"
    )
  );
  if (failed_tools.size > 0) {
    const corrected_tools = merged_tools.filter((t) => !failed_tools.has(t));
    if (!arrayStrEqual(corrected_tools, merged_tools)) {
      write_lockfile(installed_version, corrected_tools, { path: write_path });
      if (!state.QUIET) {
        warn(
          `Lockfile corrected after deploy postcheck \u2014 dropped ${[...failed_tools].sort().join(", ")} (verification failed).`
        );
      }
    }
  }
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
  if (project_root !== null && pathExists(_resolve_settings_read(project_root)) && !isDir(path10.join(project_root, ".agent-src.uncondensed"))) {
    const files_by_tool = _files_by_tool_from_deploy(deploy_results);
    const rc = _update_installed_tools_manifest(project_root, tools, "global", force, files_by_tool);
    if (rc !== 0) return rc;
    const marker_path = _write_consumer_bridge_marker(project_root, installed_version);
    if (marker_path !== null && !state.QUIET) {
      const rel = isRelativeTo(marker_path, project_root) ? path10.relative(project_root, marker_path) : marker_path;
      info(`Bridge marker written: ${rel}`);
    }
    const anchor_paths = _write_per_tool_project_anchors(project_root, tools);
    if (anchor_paths.length > 0 && !state.QUIET) {
      for (const p of anchor_paths) {
        const rel = isRelativeTo(p, project_root) ? path10.relative(project_root, p) : p;
        info(`Project anchor written: ${rel}`);
      }
    }
  }
  if (!state.QUIET) {
    process3.stdout.write("\n");
    success("Global install completed.");
    process3.stdout.write("\n");
  }
  return 0;
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
  "--apply-payload": "apply_payload"
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
    apply_payload: null
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
    const parent = path10.dirname(cur);
    if (parent === cur) break;
    chain.push(parent);
    cur = parent;
  }
  for (const ancestor of chain) {
    const candidate = path10.join(ancestor, "src", "templates", "minimal");
    if (isDir(candidate)) return candidate;
  }
  fail("Could not locate src/templates/minimal/ \u2014 package install is corrupt.");
}
var INSTALL_MODE_MARKER_REL = "agents/.agent-state/install-mode.txt";
function _write_install_mode_marker(project_root, mode) {
  if (mode !== "minimal" && mode !== "full") return;
  const marker = path10.join(project_root, INSTALL_MODE_MARKER_REL);
  try {
    mkdirp(path10.dirname(marker));
    writeText(marker, `${mode}
`);
  } catch {
  }
}
function install_minimal(target_root_in, force, user_type = "") {
  let target_root = resolvePath(target_root_in);
  mkdirp(target_root);
  const parent = path10.dirname(target_root);
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
  const settings_src = path10.join(templates, SETTINGS_FILE);
  const overrides_gitkeep_src = path10.join(templates, "overrides-gitkeep");
  const overrides_readme_src = path10.join(templates, "agents-overrides-readme.md");
  if (!isFile(settings_src)) fail(`Bundled minimal settings template missing under ${templates}`);
  if (!isFile(overrides_gitkeep_src) || !isFile(overrides_readme_src)) {
    fail(`Bundled overrides scaffold templates missing under ${templates}`);
  }
  info(`Minimal init \u2192 ${target_root}`);
  const overrides_root = path10.join(target_root, "agents", "overrides");
  mkdirp(overrides_root);
  const gitkeep_body = readText(overrides_gitkeep_src);
  for (const sub of ["rules", "skills", "commands"]) {
    const sub_dir = path10.join(overrides_root, sub);
    mkdirp(sub_dir);
    const gitkeep_dst = path10.join(sub_dir, ".gitkeep");
    if (pathExists(gitkeep_dst) && !force) {
      skip(`agents/overrides/${sub}/.gitkeep already exists (use --force to overwrite)`);
    } else {
      writeText(gitkeep_dst, gitkeep_body);
      success(`Wrote agents/overrides/${sub}/.gitkeep`);
    }
  }
  const readme_dst = path10.join(overrides_root, "README.md");
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
      mkdirp(path10.dirname(settings_dst));
      writeText(settings_dst, body);
      success(`Wrote ${SETTINGS_FILE} (user_type=${user_type})`);
    }
  }
  const installed_version = current_package_version();
  const marker_path = _write_consumer_bridge_marker(target_root, installed_version);
  if (marker_path !== null) {
    const rel = isRelativeTo(marker_path, target_root) ? path10.relative(target_root, marker_path) : marker_path;
    success(`Wrote ${rel}`);
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
  const target = path10.join(project_root, _LOCAL_CONFIG_FILE);
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
  success(`Wrote ${path10.relative(project_root, target)} (${user_type} / ${stack} / ${verbosity})`);
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
  const package_root = path10.dirname(path10.dirname(path10.dirname(resolvePath(_HERE2))));
  const cli = path10.join(package_root, "dist", "cli", "agent-config.js");
  return pathExists(cli) ? cli : null;
}
function _server_info_path() {
  return path10.join(os6.homedir(), ".event4u", "agent-config", "local-server.json");
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
    fs12.unlinkSync(p);
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
  let res;
  try {
    res = spawnSync2(cmd[0], cmd.slice(1), {
      env,
      encoding: "utf-8",
      timeout: total * 1e3,
      maxBuffer: 64 * 1024 * 1024
    });
  } catch (exc) {
    process3.stdout.write(
      `(Wizard failed to start: ${String(exc)}; run 'node ${cli} install --no-open' manually.)
`
    );
    return 0;
  }
  if (res.error && res.error.code === "ENOENT") {
    process3.stdout.write(
      `(Wizard failed to start: ${String(res.error)}; run 'node ${cli} install --no-open' manually.)
`
    );
    return 0;
  }
  const stdout = res.stdout || "";
  let matched_url = null;
  for (const line of stdout.split("\n")) {
    const m = _WIZARD_READY_RE.exec(line + "\n");
    if (m) {
      matched_url = m[1];
      break;
    }
  }
  if (matched_url === null) {
    const stderrLines = (res.stderr || "").split("\n").filter((l) => l !== "");
    const tail = stderrLines.length ? stderrLines.slice(-20).join("\n  ") : "(no stderr captured)";
    process3.stdout.write(
      `(Wizard server boot timed out after ${Math.trunc(total)}s; run 'node ${cli} install --no-open' manually.)
  Last stderr:
  ${tail}
`
    );
    return 0;
  }
  process3.stdout.write("\n");
  process3.stdout.write(`Setup wizard ready: ${matched_url}
`);
  _openBrowser(matched_url);
  process3.stdout.write("(Wizard runs in the background; close the tab or press Ctrl-C to stop.)\n");
  return res.status ?? 0;
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
    const minimal_package_root = path10.dirname(
      path10.dirname(path10.dirname(_minimal_templates_root()))
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
  const is_first_run = !pathExists(path10.join(project_root, SETTINGS_FILE));
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
function finalize_claude_model_tiers(project_root) {
  const claude_skills = path10.join(project_root, ".claude", "skills");
  const augment_skills = path10.join(project_root, ".augment", "skills");
  if (!isDir(claude_skills) || !isDir(augment_skills)) return 0;
  if (_read_consumer_auto_switch(project_root) !== "auto") return 0;
  let rendered = 0;
  const entries = fs12.readdirSync(claude_skills).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  for (const name of entries) {
    const entry = path10.join(claude_skills, name);
    const src_dir = path10.join(augment_skills, name);
    const src_md = path10.join(src_dir, "SKILL.md");
    let tier;
    try {
      tier = read_model_tier(src_md);
    } catch {
      tier = null;
    }
    if (tier === null || !(tier in TIER_TO_CLAUDE_MODEL) || !isDir(src_dir)) continue;
    if (isSymlink(entry) || isFile(entry)) {
      fs12.unlinkSync(entry);
    } else if (isDir(entry)) {
      fs12.rmSync(entry, { recursive: true, force: true });
    }
    mkdirp(entry);
    const srcFiles = fs12.readdirSync(src_dir).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
    for (const fname of srcFiles) {
      if (fname === "SKILL.md") {
        writeText(
          path10.join(entry, "SKILL.md"),
          render_native_model_md(readText(src_md), tier)
        );
      } else {
        fs12.symlinkSync(
          path10.join("../../../.augment/skills", name, fname),
          path10.join(entry, fname)
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
    if (!pathExists(path10.join(package_root, "src", "config", "profiles", "minimal.ini"))) {
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
    ensure_vscode_bridge(project_root, package_type, opts.force);
    merged_keys_by_tool["augment"] = ensure_augment_bridge(project_root, opts.force);
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
    return fs12.realpathSync(path10.resolve(process3.argv[1]));
  } catch {
    return path10.resolve(process3.argv[1]);
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
  SETTINGS_FILE,
  SUPPORTED_PROFILES,
  SystemExitError,
  USER_SCOPE_PATHS,
  WINDSURF_DISPATCHER_BINDINGS,
  ZED_MARKER,
  _VALID_TOOLS,
  _append_unknown_legacy,
  _apply_payload_preview,
  _bridge_marker,
  _canonical_settings_target,
  _detect_legacy_for_migration,
  _dry_run_summary,
  _files_by_tool_from_bridges,
  _files_by_tool_from_deploy,
  _format_global_root_for_marker,
  _inject_packs,
  _is_agent_config_source_repo,
  _is_tool_enabled,
  _merge_tools_aliases,
  _parse_legacy_settings,
  _parse_profile_ini,
  _parse_tools,
  _render_template,
  _replace_template_value,
  _replace_template_value_raw,
  _resolve_scope,
  _resolve_settings_read,
  _tools_was_all,
  _validate_scope,
  _verify_deploy_targets,
  _wizard_should_launch,
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
