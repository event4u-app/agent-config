#!/usr/bin/env node

// src/skills/corpus-grounding/scripts/ground.ts
import * as fs4 from "node:fs";
import * as path3 from "node:path";
import { fileURLToPath, pathToFileURL as pathToFileURL2 } from "node:url";

// src/skills/corpus-grounding/scripts/decision_engine.ts
import * as fs3 from "node:fs";
import * as path2 from "node:path";
import { pathToFileURL } from "node:url";

// src/skills/corpus-grounding/scripts/bm25_search.ts
import * as fs from "node:fs";
var DEFAULT_MAX_RESULTS = 3;
var PyFloat = class {
  constructor(value) {
    this.value = value;
  }
  value;
};
function floatVal(v) {
  return v instanceof PyFloat ? v.value : v;
}
function pyLen(s) {
  let n = 0;
  for (const _ of s) {
    n += 1;
  }
  return n;
}
var BM25 = class _BM25 {
  k1;
  b;
  corpus;
  doc_lengths;
  avgdl;
  idf;
  doc_freqs;
  N;
  constructor(k1 = 1.5, b = 0.75) {
    this.k1 = k1;
    this.b = b;
    this.corpus = [];
    this.doc_lengths = [];
    this.avgdl = 0;
    this.idf = {};
    this.doc_freqs = {};
    this.N = 0;
  }
  /** Lowercase, strip punctuation, drop tokens shorter than 3 chars. */
  static tokenize(text) {
    const cleaned = pyStr(text).toLowerCase().replace(/[^\p{L}\p{N}_\s]/gu, " ");
    return cleaned.split(/\s+/).filter((w) => w.length > 0 && pyLen(w) > 2);
  }
  fit(documents) {
    this.corpus = documents.map((doc) => _BM25.tokenize(doc));
    this.N = this.corpus.length;
    if (this.N === 0) {
      return;
    }
    this.doc_lengths = this.corpus.map((doc) => doc.length);
    let total = 0;
    for (const dl of this.doc_lengths) {
      total += dl;
    }
    this.avgdl = total / this.N;
    for (const doc of this.corpus) {
      for (const word of new Set(doc)) {
        this.doc_freqs[word] = (this.doc_freqs[word] ?? 0) + 1;
      }
    }
    for (const word of Object.keys(this.doc_freqs)) {
      const freq = this.doc_freqs[word];
      this.idf[word] = Math.log((this.N - freq + 0.5) / (freq + 0.5) + 1);
    }
  }
  /** Score every document; returns [index, score] sorted descending. */
  score(query) {
    const query_tokens = _BM25.tokenize(query);
    const scores = [];
    for (let idx = 0; idx < this.corpus.length; idx += 1) {
      const doc = this.corpus[idx];
      let score = 0;
      const doc_len = this.doc_lengths[idx];
      const term_freqs = {};
      for (const word of doc) {
        term_freqs[word] = (term_freqs[word] ?? 0) + 1;
      }
      for (const token of query_tokens) {
        if (token in this.idf) {
          const tf = term_freqs[token] ?? 0;
          const numerator = tf * (this.k1 + 1);
          const denominator = tf + this.k1 * (1 - this.b + this.b * doc_len / this.avgdl);
          score += this.idf[token] * (numerator / denominator);
        }
      }
      scores.push([idx, score]);
    }
    const indexed = scores.map((pair, i) => ({ pair, i }));
    indexed.sort((a, b) => {
      const d = b.pair[1] - a.pair[1];
      if (d !== 0) {
        return d;
      }
      return a.i - b.i;
    });
    return indexed.map((x) => x.pair);
  }
};
function load_csv(filepath) {
  const text = fs_readText(filepath);
  const records = _parseCsv(text);
  if (records.length === 0) {
    return [];
  }
  const header = records[0];
  const out = [];
  for (let r = 1; r < records.length; r += 1) {
    const fields = records[r];
    const row = {};
    for (let c = 0; c < header.length; c += 1) {
      const key = header[c];
      row[key] = c < fields.length ? fields[c] : "";
    }
    out.push(row);
  }
  return out;
}
function _parseCsv(text) {
  const records = [];
  let field = "";
  let record = [];
  let inQuotes = false;
  let sawAny = false;
  let i = 0;
  const n = text.length;
  const pushField = () => {
    record.push(field);
    field = "";
  };
  const pushRecord = () => {
    records.push(record);
    record = [];
  };
  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < n && text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += ch;
        i += 1;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      sawAny = true;
      i += 1;
    } else if (ch === ",") {
      pushField();
      sawAny = true;
      i += 1;
    } else if (ch === "\r" || ch === "\n") {
      pushField();
      pushRecord();
      sawAny = false;
      if (ch === "\r" && i + 1 < n && text[i + 1] === "\n") {
        i += 2;
      } else {
        i += 1;
      }
    } else {
      field += ch;
      sawAny = true;
      i += 1;
    }
  }
  if (sawAny || field.length > 0 || record.length > 0) {
    pushField();
    pushRecord();
  }
  return records;
}
function apply_filters(rows, filters) {
  if (!filters || Object.keys(filters).length === 0) {
    return rows;
  }
  const rowOk = (row) => {
    for (const col of Object.keys(filters)) {
      const want = filters[col];
      const have = pyStr(row[col] ?? "").toLowerCase();
      if (Array.isArray(want)) {
        if (!want.some((w) => have.includes(pyStr(w).toLowerCase()))) {
          return false;
        }
      } else if (!have.includes(pyStr(want).toLowerCase())) {
        return false;
      }
    }
    return true;
  };
  return rows.filter((r) => rowOk(r));
}
function _retrieve_bm25(rows, search_cols, query, max_results) {
  const documents = rows.map((row) => search_cols.map((col) => pyStr(row[col] ?? "")).join(" "));
  const bm25 = new BM25();
  bm25.fit(documents);
  const ranked = bm25.score(query);
  const out = [];
  for (const [idx, score] of ranked.slice(0, max_results)) {
    if (score > 0) {
      out.push([rows[idx], score]);
    }
  }
  return out;
}
function _retrieve_structured(rows, _search_cols, _query, max_results) {
  return rows.slice(0, max_results).map((row) => [row, 1]);
}
function _retrieve_hybrid(rows, search_cols, query, max_results) {
  if (query.trim() === "") {
    return _retrieve_structured(rows, search_cols, query, max_results);
  }
  return _retrieve_bm25(rows, search_cols, query, max_results);
}
var RETRIEVERS = {
  bm25: _retrieve_bm25,
  structured: _retrieve_structured,
  hybrid: _retrieve_hybrid
};
function search_rows(filepath, search_cols, output_cols, query, max_results = DEFAULT_MAX_RESULTS, filters = null, retriever = "bm25") {
  if (!(retriever in RETRIEVERS)) {
    const available = Object.keys(RETRIEVERS).sort();
    throw new ValueError(
      `Unknown retriever: ${pyRepr(retriever)}. Available: ${pyReprList(available)}`
    );
  }
  if (!fs_exists(filepath)) {
    return { error: `File not found: ${filepath}`, count: 0, results: [] };
  }
  let rows = load_csv(filepath);
  const total = rows.length;
  rows = apply_filters(rows, filters);
  const hits = RETRIEVERS[retriever](rows, search_cols, query, max_results);
  const results = hits.map(([row]) => {
    const projection = {};
    for (const col of output_cols) {
      if (col in row) {
        projection[col] = row[col] ?? "";
      }
    }
    return projection;
  });
  return {
    count: results.length,
    results,
    // Python scores are floats (BM25 math + the structured 1.0). Wrap so
    // an integral score (e.g. 1.0) serialises with its `.0`.
    scores: hits.map(([, score]) => new PyFloat(score)),
    filtered_from: total
  };
}
var ValueError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "ValueError";
  }
};
function pyStr(value) {
  if (value === null || value === void 0) {
    return value === null ? "None" : "undefined";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }
  return String(value);
}
function pyRepr(s) {
  const hasSingle = s.includes("'");
  const hasDouble = s.includes('"');
  if (hasSingle && !hasDouble) {
    return `"${s.replace(/\\/g, "\\\\")}"`;
  }
  return `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}
function pyReprList(items) {
  return `[${items.map((i) => pyRepr(i)).join(", ")}]`;
}
function fs_readText(p) {
  return fs.readFileSync(p, "utf-8");
}
function fs_exists(p) {
  return fs.existsSync(p);
}

// src/skills/corpus-grounding/scripts/schema_validator.ts
import * as fs2 from "node:fs";
import * as path from "node:path";
var MANIFEST_VERSION = 1;
var TIERS = ["lookup-only", "conditional-grounding", "constraint-emission"];
var _REQUIRED_TOP = ["manifest_version", "domain", "tier", "domains"];
var _REQUIRED_PROVENANCE = ["owner", "refresh_cadence", "upstream"];
var _REQUIRED_DOMAIN_KEYS = ["file", "search_cols", "output_cols"];
var _REQUIRED_REASONING_KEYS = ["file", "match_column", "plan"];
var ManifestError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "ManifestError";
  }
};
function _pyTruthy(value) {
  if (value === null || value === void 0 || value === false) {
    return false;
  }
  if (value === true) {
    return true;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    return value.length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === "object") {
    return Object.keys(value).length > 0;
  }
  return true;
}
function _isDict(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function _repr(value) {
  if (typeof value === "string") {
    return pyRepr(value);
  }
  if (value === null || value === void 0) {
    return "None";
  }
  if (value === true) {
    return "True";
  }
  if (value === false) {
    return "False";
  }
  if (typeof value === "number") {
    return String(value);
  }
  return String(value);
}
function _tiersRepr() {
  return `(${TIERS.map((t) => pyRepr(t)).join(", ")})`;
}
function load_manifest(p) {
  if (!fs2.existsSync(p)) {
    throw new ManifestError(`Manifest not found: ${p}`);
  }
  let data;
  try {
    data = JSON.parse(fs2.readFileSync(p, "utf-8"));
  } catch (exc) {
    throw new ManifestError(`Manifest is not valid JSON: ${p}: ${_jsonErr(exc)}`);
  }
  const errors = validate_manifest(data);
  if (errors.length > 0) {
    throw new ManifestError(
      `Manifest contract violations in ${p}:
  - ${errors.join("\n  - ")}`
    );
  }
  const manifest = data;
  manifest._manifest_dir = path.dirname(pyResolve(p));
  return manifest;
}
function validate_manifest(data) {
  const errors = [];
  if (!_isDict(data)) {
    return ["manifest must be a JSON object"];
  }
  for (const key of _REQUIRED_TOP) {
    if (!(key in data)) {
      errors.push(`missing required key: ${pyRepr(key)}`);
    }
  }
  if (errors.length > 0) {
    return errors;
  }
  if (data.manifest_version !== MANIFEST_VERSION) {
    errors.push(`manifest_version ${_repr(data.manifest_version)} unsupported (engine speaks v${MANIFEST_VERSION})`);
  }
  if (!TIERS.includes(data.tier)) {
    errors.push(`tier ${_repr(data.tier)} not in ${_tiersRepr()}`);
  }
  const domains = data.domains;
  if (!_isDict(domains) || Object.keys(domains).length === 0) {
    errors.push("domains must be a non-empty object");
  } else {
    for (const name of Object.keys(domains)) {
      const cfg = domains[name];
      if (!_isDict(cfg)) {
        errors.push(`domains.${name} must be an object`);
        continue;
      }
      for (const key of _REQUIRED_DOMAIN_KEYS) {
        if (!(key in cfg)) {
          errors.push(`domains.${name} missing ${pyRepr(key)}`);
        }
      }
      for (const key of ["search_cols", "output_cols"]) {
        if (key in cfg && (!Array.isArray(cfg[key]) || cfg[key].length === 0)) {
          errors.push(`domains.${name}.${key} must be a non-empty list`);
        }
      }
    }
  }
  const default_domain = data.default_domain;
  if (_pyTruthy(default_domain) && _isDict(domains) && !(String(default_domain) in domains)) {
    errors.push(`default_domain ${_repr(default_domain)} not in domains`);
  }
  const detect = data.detect;
  if (detect !== void 0 && detect !== null) {
    if (!_isDict(detect)) {
      errors.push("detect must be an object of domain \u2192 keyword list");
    } else if (_isDict(domains)) {
      for (const name of Object.keys(detect)) {
        const kws = detect[name];
        if (!(name in domains) && name !== "_stack") {
          errors.push(`detect.${name} references unknown domain`);
        }
        if (!Array.isArray(kws)) {
          errors.push(`detect.${name} must be a list of keywords`);
        }
      }
    }
  }
  const reasoning = data.reasoning;
  if (reasoning !== void 0 && reasoning !== null) {
    if (data.tier === "lookup-only") {
      errors.push("reasoning block present but tier is lookup-only");
    }
    if (!_isDict(reasoning)) {
      errors.push("reasoning must be an object");
    } else {
      for (const key of _REQUIRED_REASONING_KEYS) {
        if (!(key in reasoning)) {
          errors.push(`reasoning missing ${pyRepr(key)}`);
        }
      }
      const plan = reasoning.plan;
      if (plan !== void 0 && plan !== null) {
        if (!_isDict(plan)) {
          errors.push("reasoning.plan must be an object of domain \u2192 max_results");
        } else if (_isDict(domains)) {
          for (const name of Object.keys(plan)) {
            if (!(name in domains)) {
              errors.push(`reasoning.plan.${name} references unknown domain`);
            }
          }
        }
      }
    }
  }
  const stacks = data.stacks;
  if (stacks !== void 0 && stacks !== null) {
    if (!_isDict(stacks)) {
      errors.push("stacks must be an object of stack-id \u2192 csv path");
    } else if (!("stack_cols" in data)) {
      errors.push("stacks present but stack_cols missing");
    }
  }
  for (const key of _REQUIRED_PROVENANCE) {
    if (!(key in data)) {
      errors.push(`missing provenance key: ${pyRepr(key)} (ADR-061 \xA76)`);
    }
  }
  const upstream = data.upstream;
  if (_isDict(upstream)) {
    for (const key of ["repo", "sha", "last_checked"]) {
      if (!(key in upstream)) {
        errors.push(`upstream missing ${pyRepr(key)}`);
      }
    }
  } else if (upstream !== void 0 && upstream !== null) {
    errors.push("upstream must be an object {repo, sha, last_checked}");
  }
  const retriever = data.retriever;
  if (retriever !== void 0 && retriever !== null && !["bm25", "structured", "hybrid"].includes(retriever)) {
    errors.push(`retriever ${_repr(retriever)} unknown`);
  }
  return errors;
}
function resolve_data_path(manifest, relative) {
  if (path.isAbsolute(relative) || _pathParts(relative).includes("..")) {
    throw new ManifestError(`corpus path must be manifest-relative: ${pyRepr(relative)}`);
  }
  const base = manifest._manifest_dir ?? ".";
  const data_dir = manifest.data_dir ?? ".";
  if (path.isAbsolute(data_dir) || _pathParts(data_dir).includes("..")) {
    throw new ManifestError(`data_dir must be manifest-relative: ${pyRepr(data_dir)}`);
  }
  const resolved = pyResolve(path.join(base, data_dir, relative));
  const root = pyResolve(base);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new ManifestError(`corpus path resolves outside the manifest directory: ${pyRepr(relative)}`);
  }
  return resolved;
}
function _pathParts(p) {
  return p.split(/[\\/]/u).filter((seg) => seg !== "" && seg !== ".");
}
function pyResolve(p) {
  const abs = path.resolve(p);
  let cur = abs;
  const suffix = [];
  for (; ; ) {
    try {
      const real = fs2.realpathSync.native(cur);
      return suffix.length > 0 ? path.join(real, ...suffix) : real;
    } catch {
      const parent = path.dirname(cur);
      if (parent === cur) {
        return abs;
      }
      suffix.unshift(path.basename(cur));
      cur = parent;
    }
  }
}
function _jsonErr(exc) {
  if (exc instanceof Error) {
    return exc.message;
  }
  return String(exc);
}

// src/skills/corpus-grounding/scripts/decision_engine.ts
function pyRound(value, ndigits = 0) {
  if (!Number.isFinite(value) || value === 0) {
    return value;
  }
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const str = abs.toPrecision(17);
  if (str.includes("e") || str.includes("E")) {
    const factor2 = 10 ** ndigits;
    return value > 0 ? Math.round(abs * factor2) / factor2 * sign : -Math.round(abs * factor2) / factor2;
  }
  const dot = str.indexOf(".");
  const intPart = dot === -1 ? str : str.slice(0, dot);
  let fracPart = dot === -1 ? "" : str.slice(dot + 1);
  while (fracPart.length <= ndigits) {
    fracPart += "0";
  }
  const keepFrac = fracPart.slice(0, ndigits);
  const deciderStr = fracPart.slice(ndigits);
  const scaledIntStr = intPart + keepFrac;
  let scaledInt = BigInt(scaledIntStr === "" ? "0" : scaledIntStr);
  const firstDecider = deciderStr.charAt(0);
  const restNonZero = /[1-9]/u.test(deciderStr.slice(1));
  let roundUp = false;
  if (firstDecider > "5" || firstDecider === "5" && restNonZero) {
    roundUp = true;
  } else if (firstDecider === "5" && !restNonZero) {
    roundUp = scaledInt % 2n === 1n;
  }
  if (roundUp) {
    scaledInt += 1n;
  }
  const factor = 10 ** ndigits;
  return Number(scaledInt) / factor * sign;
}
function pyStr2(value) {
  if (value === null || value === void 0) {
    return "None";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }
  if (value instanceof PyFloat) {
    return _floatStr(value.value);
  }
  return String(value);
}
function _strRepr(s) {
  const hasSingle = s.includes("'");
  const hasDouble = s.includes('"');
  let quote = "'";
  if (hasSingle && !hasDouble) {
    quote = '"';
  }
  let body = s.replace(/\\/g, "\\\\");
  if (quote === "'") {
    body = body.replace(/'/g, "\\'");
  }
  return `${quote}${body}${quote}`;
}
function _valueRepr(value) {
  if (typeof value === "string") {
    return _strRepr(value);
  }
  if (value === null || value === void 0) {
    return "None";
  }
  if (value === true) {
    return "True";
  }
  if (value === false) {
    return "False";
  }
  return String(value);
}
function pyDictRepr(obj) {
  const parts = Object.keys(obj).map((k) => `${_strRepr(k)}: ${_valueRepr(obj[k])}`);
  return `{${parts.join(", ")}}`;
}
function _floatStr(n) {
  if (Number.isInteger(n)) {
    return `${n}.0`;
  }
  return String(n);
}
function _reEscape(s) {
  return s.replace(/[\\^$.*+?()[\]{}|/]/gu, "\\$&");
}
function detect_domain(manifest, query) {
  const detect = manifest.detect || {};
  const query_lower = query.toLowerCase();
  const scores = {};
  for (const name of Object.keys(detect)) {
    if (name === "_stack") {
      continue;
    }
    const keywords = detect[name];
    let count = 0;
    if (Array.isArray(keywords)) {
      for (const kw of keywords) {
        const re = new RegExp(`\\b${_reEscape(pyStr2(kw).toLowerCase())}\\b`, "u");
        if (re.test(query_lower)) {
          count += 1;
        }
      }
    }
    scores[name] = count;
  }
  const names = Object.keys(scores);
  if (names.length > 0) {
    let best = names[0];
    for (const name of names) {
      if (scores[name] > scores[best]) {
        best = name;
      }
    }
    if (scores[best] > 0) {
      return best;
    }
  }
  const dd = manifest.default_domain;
  if (dd !== void 0 && dd !== null && dd !== "" && dd !== false) {
    return String(dd);
  }
  const domains = manifest.domains;
  return Object.keys(domains)[0];
}
function search_domain(manifest, query, domain = null, max_results = null, filters = null) {
  let dom = domain;
  if (dom === null) {
    dom = detect_domain(manifest, query);
  }
  const domains = manifest.domains;
  if (!(dom in domains)) {
    return {
      error: `Unknown domain: ${_strRepr(dom)}. Available: ${_sortedListRepr(Object.keys(domains))}`,
      count: 0,
      results: []
    };
  }
  const cfg = domains[dom];
  const merged_filters = { ...cfg.filters || {} };
  if (filters) {
    for (const k of Object.keys(filters)) {
      merged_filters[k] = filters[k];
    }
  }
  const result = search_rows(
    resolve_data_path(manifest, cfg.file),
    cfg.search_cols,
    cfg.output_cols,
    query,
    max_results ?? cfg.max_results ?? DEFAULT_MAX_RESULTS,
    Object.keys(merged_filters).length > 0 ? merged_filters : null,
    manifest.retriever ?? "bm25"
  );
  result.domain = dom;
  result.query = query;
  result.file = cfg.file;
  _attach_confidence(result);
  return result;
}
function search_stack(manifest, query, stack, max_results = DEFAULT_MAX_RESULTS, filters = null) {
  const stacks = manifest.stacks || {};
  if (!(stack in stacks)) {
    return {
      error: `Unknown stack: ${_strRepr(stack)}. Available: ${_sortedListRepr(Object.keys(stacks))}`,
      count: 0,
      results: []
    };
  }
  const cols = manifest.stack_cols;
  const result = search_rows(
    resolve_data_path(manifest, stacks[stack]),
    cols.search_cols,
    cols.output_cols,
    query,
    max_results,
    filters,
    manifest.retriever ?? "bm25"
  );
  result.domain = "stack";
  result.stack = stack;
  result.query = query;
  result.file = stacks[stack];
  _attach_confidence(result);
  return result;
}
function _attach_confidence(result) {
  const scores = result.scores || [];
  const gaps = [];
  let label;
  let numeric;
  if (scores.length === 0) {
    label = "low";
    numeric = 0;
    const dom = result.domain;
    gaps.push(
      `no corpus rows matched the query in domain '${dom === void 0 || dom === null ? "?" : String(dom)}' \u2014 answer falls back to agent priors`
    );
  } else {
    const top = floatVal(scores[0]);
    numeric = pyRound(Math.min(1, top / 10), 3);
    if (top >= 4) {
      label = "high";
    } else if (top >= 1.5) {
      label = "medium";
    } else {
      label = "low";
      gaps.push("top BM25 score is weak \u2014 treat the match as a hint, not a verdict");
    }
  }
  result.confidence = { label, score: new PyFloat(numeric) };
  result.evidence_gap = gaps;
}
function evaluate_rules(rules, query, context = null) {
  const ctx = context || {};
  const query_lower = query.toLowerCase();
  const matched = {};
  const unmatched = {};
  for (const key of Object.keys(rules || {})) {
    const directive = rules[key];
    const cond = key.startsWith("if_") ? key.slice(3) : key;
    const tokens = cond.split("_").filter((t) => t.length > 0);
    const ctxHit = _bool(ctx[cond]);
    const tokenHit = tokens.length > 0 && tokens.every((t) => query_lower.includes(t));
    const hit = ctxHit || tokenHit;
    (hit ? matched : unmatched)[key] = directive;
  }
  return { matched, unmatched };
}
function _bool(value) {
  if (value === null || value === void 0 || value === false) {
    return false;
  }
  if (value === true) {
    return true;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    return value.length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === "object") {
    return Object.keys(value).length > 0;
  }
  return true;
}
async function _load_rules_callable(manifest) {
  const reasoning = manifest.reasoning || {};
  const rel = reasoning.rules_module;
  if (!rel) {
    return null;
  }
  const resolved = resolve_data_path(manifest, rel);
  const candidate = _resolveTwinPath(resolved);
  if (!fs3.existsSync(candidate)) {
    throw new ManifestError(`reasoning.rules_module not found: ${resolved}`);
  }
  const mod = await import(pathToFileURL(candidate).href);
  const fn = mod.evaluate;
  if (typeof fn !== "function") {
    throw new ManifestError(`${resolved} must expose evaluate(rules, query, context)`);
  }
  return fn;
}
function _resolveTwinPath(resolved) {
  const ext = path2.extname(resolved);
  if (ext === ".py") {
    const stem = resolved.slice(0, resolved.length - ext.length);
    if (fs3.existsSync(`${stem}.ts`)) {
      return `${stem}.ts`;
    }
    return `${stem}.js`;
  }
  if (ext === "") {
    if (fs3.existsSync(`${resolved}.ts`)) {
      return `${resolved}.ts`;
    }
    return `${resolved}.js`;
  }
  return resolved;
}
function _find_reasoning_rule(rows, match_column, category) {
  const category_lower = category.toLowerCase();
  for (const rule of rows) {
    if (pyStr2(rule[match_column] ?? "").toLowerCase() === category_lower) {
      return rule;
    }
  }
  for (const rule of rows) {
    const cat = pyStr2(rule[match_column] ?? "").toLowerCase();
    if (cat && (category_lower.includes(cat) || cat.includes(category_lower))) {
      return rule;
    }
  }
  for (const rule of rows) {
    const cat = pyStr2(rule[match_column] ?? "").toLowerCase();
    const keywords = cat.replace(/\//g, " ").replace(/-/g, " ").split(/\s+/u).filter((w) => w.length > 0);
    if (keywords.some((kw) => category_lower.includes(kw))) {
      return rule;
    }
  }
  return {};
}
function _select_best_match(results, priority_keywords, name_col) {
  if (results.length === 0) {
    return {};
  }
  if (priority_keywords.length === 0) {
    return results[0];
  }
  if (name_col) {
    for (const priority of priority_keywords) {
      const p = priority.toLowerCase().trim();
      for (const result of results) {
        const name = pyStr2(result[name_col] ?? "").toLowerCase();
        if (p && (name.includes(p) || p.includes(name))) {
          return result;
        }
      }
    }
  }
  const scored = [];
  for (const result of results) {
    const blob = pyDictRepr(result).toLowerCase();
    let score = 0;
    for (const kw of priority_keywords) {
      const k = kw.toLowerCase().trim();
      if (!k) {
        continue;
      }
      if (name_col && pyStr2(result[name_col] ?? "").toLowerCase().includes(k)) {
        score += 10;
      } else if (pyStr2(result.Keywords ?? "").toLowerCase().includes(k)) {
        score += 3;
      } else if (blob.includes(k)) {
        score += 1;
      }
    }
    scored.push([score, result]);
  }
  const indexed = scored.map((pair, i) => ({ pair, i }));
  indexed.sort((a, b) => {
    const d = b.pair[0] - a.pair[0];
    if (d !== 0) {
      return d;
    }
    return a.i - b.i;
  });
  const sorted = indexed.map((x) => x.pair);
  if (sorted.length > 0 && sorted[0][0] > 0) {
    return sorted[0][1];
  }
  return results[0];
}
var DIAL_TIERS = {
  variance: [
    [1, 3, { label: "Centered / Minimal", style_keywords: ["Minimalism", "Exaggerated Minimalism", "centered", "symmetric", "grid-based"] }],
    [4, 7, { label: "Balanced / Modern", style_keywords: ["modern", "structured", "balanced"] }],
    [8, 10, { label: "Bold / Asymmetric", style_keywords: ["Brutalism", "Bento Grids", "asymmetric", "experimental"] }]
  ],
  motion: [
    [1, 3, { label: "Subtle", tier: "Subtle" }],
    [4, 7, { label: "Standard", tier: "Standard" }],
    [8, 10, { label: "Complex", tier: "Complex" }]
  ],
  density: [
    [1, 3, { label: "Spacious", spacing: { xs: "4px", sm: "8px", md: "24px", lg: "32px", xl: "48px", "2xl": "64px", "3xl": "96px" } }],
    [4, 7, { label: "Standard", spacing: { xs: "4px", sm: "8px", md: "16px", lg: "24px", xl: "32px", "2xl": "48px", "3xl": "64px" } }],
    [8, 10, { label: "Dense / Dashboard", spacing: { xs: "2px", sm: "4px", md: "8px", lg: "12px", xl: "16px", "2xl": "24px", "3xl": "32px" } }]
  ]
};
function resolve_dial(dial_name, value) {
  if (value === null || value === void 0 || Number.isNaN(value)) return null;
  const tiers = DIAL_TIERS[dial_name];
  if (tiers === void 0) return null;
  const v = Math.max(1, Math.min(10, Math.trunc(value)));
  for (const [lo, hi, info] of tiers) {
    if (v >= lo && v <= hi) return { ...info, value: v };
  }
  return null;
}
async function ground(manifest, query, context = null, dials = null) {
  const reasoning = manifest.reasoning;
  if (!reasoning) {
    throw new ManifestError(
      `manifest domain ${_valueRepr(manifest.domain)} has no reasoning block (tier is lookup-only \u2014 use search instead of ground)`
    );
  }
  const gaps = [];
  let category = manifest.default_category ?? "General";
  const cat_domain = reasoning.category_domain;
  const cat_column = reasoning.category_column;
  if (cat_domain && cat_column) {
    const cat_result = search_domain(manifest, query, cat_domain, 1);
    const rows = cat_result.results || [];
    if (rows.length > 0) {
      const v = rows[0][cat_column];
      category = v !== void 0 && v !== null && v !== "" ? pyStr2(v) : category;
    } else {
      gaps.push(
        `category lookup in '${cat_domain}' found nothing \u2014 grounding against default category '${category}'`
      );
    }
  }
  const rules_path = resolve_data_path(manifest, reasoning.file);
  const rule_rows = fs3.existsSync(rules_path) ? load_csv(rules_path) : [];
  const rule = _find_reasoning_rule(rule_rows, reasoning.match_column, category);
  if (Object.keys(rule).length === 0) {
    gaps.push(
      `no reasoning rule matched category '${category}' \u2014 selections below are unweighted corpus hits`
    );
  }
  let raw_rules = {};
  const rules_column = reasoning.rules_column;
  if (rules_column && _bool(rule[rules_column])) {
    try {
      raw_rules = JSON.parse(rule[rules_column]);
    } catch {
      gaps.push(`decision rules in column '${rules_column}' are not valid JSON`);
    }
  }
  const custom = await _load_rules_callable(manifest);
  const rules_evaluation = custom ? custom(raw_rules, query, context || {}) : evaluate_rules(raw_rules, query, context);
  let priority = [];
  const priority_column = reasoning.priority_column;
  if (priority_column && _bool(rule[priority_column])) {
    priority = pyStr2(rule[priority_column]).split("+").map((s) => s.trim()).filter((s) => s.length > 0);
  }
  const variance_info = resolve_dial("variance", dials?.variance);
  const motion_info = resolve_dial("motion", dials?.motion);
  const density_info = resolve_dial("density", dials?.density);
  const selection_priority = variance_info ? [...variance_info.style_keywords, ...priority] : priority;
  const selections = {};
  const domain_confidences = [];
  const plan = reasoning.plan || {};
  const priority_domain = reasoning.priority_domain;
  const name_cols = reasoning.name_columns || {};
  for (const domain_name of Object.keys(plan)) {
    const max_results = plan[domain_name];
    let q = query;
    if (domain_name === priority_domain && priority.length > 0) {
      q = `${query} ${priority.slice(0, 2).join(" ")}`;
    }
    const result = search_domain(manifest, q, domain_name, _int(max_results));
    const results = result.results || [];
    let best;
    if (domain_name === priority_domain) {
      best = _select_best_match(results, selection_priority, name_cols[domain_name]);
      if (variance_info) {
        const ungated = _select_best_match(results, priority, name_cols[domain_name]);
        if (ungated !== best) {
          const col = name_cols[domain_name];
          const nameOf = (r) => col && r[col] !== void 0 ? pyStr2(r[col]) : "(unnamed)";
          gaps.push(
            `--variance ${String(variance_info.value)} changed the ${domain_name} pick to '${nameOf(best)}'; the rule's own keywords would have selected '${nameOf(ungated)}' \u2014 the dial biased the choice, it did not come from the corpus`
          );
        }
      }
    } else {
      best = results.length > 0 ? results[0] : {};
    }
    selections[domain_name] = {
      best,
      // Python: [r for r in results if r is not best] — identity compare.
      alternatives: results.filter((r) => r !== best),
      confidence: result.confidence
    };
    for (const g of result.evidence_gap || []) {
      gaps.push(g);
    }
    const conf = result.confidence || {};
    const score = conf.score;
    domain_confidences.push(score instanceof PyFloat ? score.value : score ?? 0);
  }
  let motion_selection = null;
  if (motion_info) {
    const tier = motion_info.tier;
    const motion_domain = manifest.domains["gsap"];
    if (motion_domain === void 0) {
      gaps.push(
        "the --motion dial needs a 'gsap' search domain (motion.csv); this manifest has none, so the dial had no effect"
      );
    } else {
      const motion_max = motion_domain["max_results"];
      const motion_result = search_domain(
        manifest,
        query,
        "gsap",
        typeof motion_max === "number" ? motion_max : null,
        { "Intensity Tier": tier }
      );
      const rows = motion_result.results || [];
      if (rows.length === 0) {
        gaps.push(`no motion row at tier '${tier}' matched the query \u2014 the dial narrowed to nothing`);
      } else {
        motion_selection = {
          tier,
          best: rows[0],
          alternatives: rows.slice(1),
          confidence: motion_result.confidence
        };
      }
    }
  }
  const numeric = domain_confidences.length > 0 ? pyRound(Math.min(...domain_confidences), 3) : 0;
  const label = numeric >= 0.4 ? "high" : numeric >= 0.15 ? "medium" : "low";
  const ruleOut = {};
  for (const k of Object.keys(rule)) {
    if (k !== rules_column) {
      ruleOut[k] = rule[k];
    }
  }
  const out = {
    domain: manifest.domain,
    query,
    category,
    rule: ruleOut,
    rules_evaluation,
    selections,
    confidence: { label, score: new PyFloat(numeric) },
    evidence_gap: gaps.length > 0 ? gaps : ["none \u2014 every planned domain returned a scored match"]
  };
  if (variance_info || motion_info || density_info) {
    out.dials = {
      variance: variance_info ? variance_info.value : null,
      variance_label: variance_info ? variance_info.label : null,
      motion: motion_info ? motion_info.value : null,
      motion_label: motion_info ? motion_info.label : null,
      density: density_info ? density_info.value : null,
      density_label: density_info ? density_info.label : null
    };
    if (motion_selection) out.motion = motion_selection;
    if (density_info) out.spacing_scale = density_info.spacing;
  }
  return out;
}
function _int(value) {
  if (typeof value === "number") {
    return Math.trunc(value);
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  return Math.trunc(Number(value));
}
function persist_grounding(grounded, output_dir, project = null, page = null) {
  const project_slug = (project ?? pyStr2(grounded.query ?? "default")).toLowerCase().replace(/ /g, "-");
  const base = path2.join(output_dir, "design-system", project_slug);
  fs3.mkdirSync(base, { recursive: true });
  const created = [];
  const master = path2.join(base, "MASTER.md");
  fs3.writeFileSync(master, _render_markdown(grounded, true), "utf-8");
  created.push(master);
  if (page) {
    const pages = path2.join(base, "pages");
    fs3.mkdirSync(pages, { recursive: true });
    const page_file = path2.join(pages, `${page.toLowerCase().replace(/ /g, "-")}.md`);
    fs3.writeFileSync(
      page_file,
      `# ${_title(page)} \u2014 page overrides

> Rules here OVERRIDE the project MASTER.md for this page only.
> Start empty; add only deviations.
`,
      "utf-8"
    );
    created.push(page_file);
  }
  return { status: "success", created_files: created };
}
function _title(s) {
  return s.replace(/[A-Za-z]+/gu, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}
function _render_markdown(grounded, master = false) {
  const lines = [];
  if (master) {
    lines.push(
      "# Design System Master File",
      "",
      "> **LOGIC:** When building a specific page, first check `pages/<page>.md`. If it exists, its rules **override** this master file. Otherwise follow the rules below.",
      ""
    );
  }
  const conf = grounded.confidence || {};
  lines.push(
    `## Grounded recommendation: ${pyStr2(grounded.query ?? "")}`,
    "",
    `- **Domain:** ${pyStr2(grounded.domain ?? "")}`,
    `- **Category:** ${pyStr2(grounded.category ?? "")}`,
    `- **Confidence:** ${pyStr2(conf.label ?? "?")} (${_confScore(conf.score)})`,
    ""
  );
  const dials = grounded.dials || null;
  if (dials) {
    const dialLines = [];
    for (const name of ["variance", "motion", "density"]) {
      const value = dials[name];
      if (value === null || value === void 0) {
        continue;
      }
      const label = dials[`${name}_label`];
      dialLines.push(
        `- **${name[0]?.toUpperCase()}${name.slice(1)}:** ${pyStr2(value)}/10` + (label ? ` \u2014 ${pyStr2(label)}` : "")
      );
    }
    if (dialLines.length > 0) {
      lines.push("### Dials", "", ...dialLines, "");
    }
  }
  const spacing = grounded.spacing_scale || null;
  if (spacing && Object.keys(spacing).length > 0) {
    lines.push("### Spacing scale (density override)", "");
    for (const step of Object.keys(spacing)) {
      lines.push(`- **${step}:** ${pyStr2(spacing[step])}`);
    }
    lines.push("");
  }
  const motion = grounded.motion || null;
  const motionBest = motion ? motion.best || {} : {};
  if (motion && Object.keys(motionBest).length > 0) {
    lines.push(`### Motion (tier: ${pyStr2(motion.tier ?? "")})`, "");
    for (const key of Object.keys(motionBest)) {
      lines.push(`- **${key}:** ${pyStr2(motionBest[key])}`);
    }
    lines.push("");
  }
  const selections = grounded.selections || {};
  for (const domain of Object.keys(selections)) {
    const sel = selections[domain] || {};
    const best = sel.best || {};
    if (Object.keys(best).length === 0) {
      continue;
    }
    lines.push(`### ${domain}`);
    for (const key of Object.keys(best)) {
      let value_str = pyStr2(best[key]);
      if (value_str.length > 300) {
        value_str = `${value_str.slice(0, 300)}\u2026`;
      }
      if (value_str) {
        lines.push(`- **${key}:** ${value_str}`);
      }
    }
    lines.push("");
  }
  const matched = (grounded.rules_evaluation || {}).matched;
  const matchedObj = matched || {};
  if (Object.keys(matchedObj).length > 0) {
    lines.push("### Matched decision rules");
    for (const key of Object.keys(matchedObj)) {
      lines.push(`- \`${key}\` \u2192 ${pyStr2(matchedObj[key])}`);
    }
    lines.push("");
  }
  lines.push("### Evidence gap");
  for (const gap of grounded.evidence_gap || []) {
    lines.push(`- ${gap}`);
  }
  lines.push("");
  return lines.join("\n");
}
function _confScore(score) {
  if (score instanceof PyFloat) {
    return _floatStr(score.value);
  }
  if (score === void 0 || score === null) {
    return "0";
  }
  return String(score);
}
function _sortedListRepr(items) {
  const sorted = [...items].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  return `[${sorted.map((i) => _strRepr(i)).join(", ")}]`;
}

// src/skills/corpus-grounding/scripts/ground.ts
function _parse_filters(pairs) {
  const collected = {};
  for (const pair of pairs || []) {
    if (!pair.includes("=")) {
      process.stderr.write(`--filter expects COLUMN=VALUE, got: ${_repr2(pair)}
`);
      process.exit(1);
    }
    const idx = pair.indexOf("=");
    const col = pair.slice(0, idx);
    const value = pair.slice(idx + 1);
    if (!(col in collected)) {
      collected[col] = [];
    }
    collected[col].push(value);
  }
  const out = {};
  for (const k of Object.keys(collected)) {
    const v = collected[k];
    out[k] = v.length > 1 ? v : v[0];
  }
  return out;
}
function _format_search(result) {
  if (_truthy(result.error)) {
    return `Error: ${result.error}`;
  }
  const out = ["## Corpus search results"];
  const head = `**Domain:** ${_orStr(result.stack, result.domain)} | **Query:** ${_str(result.query)}`;
  out.push(head);
  const conf = result.confidence || {};
  out.push(
    `**Source:** ${_str(result.file)} | **Found:** ${_str(result.count)} | **Confidence:** ${_str(conf.label)} (${_confScore2(conf.score)})`
  );
  out.push("");
  const results = result.results || [];
  let i = 1;
  for (const row of results) {
    out.push(`### Result ${i}`);
    for (const key of Object.keys(row)) {
      let value_str = _str(row[key]);
      if (value_str.length > 300) {
        value_str = `${value_str.slice(0, 300)}\u2026`;
      }
      if (value_str) {
        out.push(`- **${key}:** ${value_str}`);
      }
    }
    out.push("");
    i += 1;
  }
  const gaps = result.evidence_gap || [];
  if (gaps.length > 0) {
    out.push("### Evidence gap");
    for (const g of gaps) {
      out.push(`- ${g}`);
    }
  }
  return out.join("\n");
}
function _dial(flag, raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    process.stderr.write(`argument ${flag}: expected an integer 1-10, got '${raw}'
`);
    process.exit(2);
  }
  return Math.trunc(n);
}
function _parseArgs(argv) {
  const op = argv[0];
  if (op !== "search" && op !== "ground" && op !== "validate") {
    process.stderr.write(`ground: invalid operation: ${op ?? "(none)"}
`);
    process.exit(2);
  }
  const rest = argv.slice(1);
  const args = {
    op,
    manifest: "",
    json: false,
    filter: [],
    domain: null,
    stack: null,
    max_results: null,
    retriever: null,
    hasRetriever: op === "search",
    context: null,
    persist: null,
    project_name: null,
    page: null
  };
  const positionals = [];
  let manifestSet = false;
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    const eat = () => {
      const v = rest[i + 1];
      if (v === void 0) {
        process.stderr.write(`argument ${a}: expected one argument
`);
        process.exit(2);
      }
      i += 1;
      return v;
    };
    if (a === "--manifest") {
      args.manifest = eat();
      manifestSet = true;
    } else if (a.startsWith("--manifest=")) {
      args.manifest = a.slice("--manifest=".length);
      manifestSet = true;
    } else if (a === "--json") {
      args.json = true;
    } else if (a === "--domain" || a === "-d") {
      args.domain = eat();
    } else if (a.startsWith("--domain=")) {
      args.domain = a.slice("--domain=".length);
    } else if (a === "--stack" || a === "-s") {
      args.stack = eat();
    } else if (a.startsWith("--stack=")) {
      args.stack = a.slice("--stack=".length);
    } else if (a === "--max-results" || a === "-n") {
      args.max_results = parseInt(eat(), 10);
    } else if (a.startsWith("--max-results=")) {
      args.max_results = parseInt(a.slice("--max-results=".length), 10);
    } else if (a === "--filter") {
      args.filter.push(eat());
    } else if (a.startsWith("--filter=")) {
      args.filter.push(a.slice("--filter=".length));
    } else if (a === "--retriever") {
      args.retriever = eat();
    } else if (a.startsWith("--retriever=")) {
      args.retriever = a.slice("--retriever=".length);
    } else if (a === "--context") {
      args.context = eat();
    } else if (a.startsWith("--context=")) {
      args.context = a.slice("--context=".length);
    } else if (a === "--persist") {
      args.persist = eat();
    } else if (a.startsWith("--persist=")) {
      args.persist = a.slice("--persist=".length);
    } else if (a === "--project-name" || a === "-p") {
      args.project_name = eat();
    } else if (a.startsWith("--project-name=")) {
      args.project_name = a.slice("--project-name=".length);
    } else if (a === "--page") {
      args.page = eat();
    } else if (a.startsWith("--page=")) {
      args.page = a.slice("--page=".length);
    } else if (a === "--variance") {
      args.variance = _dial("--variance", eat());
    } else if (a.startsWith("--variance=")) {
      args.variance = _dial("--variance", a.slice("--variance=".length));
    } else if (a === "--motion") {
      args.motion = _dial("--motion", eat());
    } else if (a.startsWith("--motion=")) {
      args.motion = _dial("--motion", a.slice("--motion=".length));
    } else if (a === "--density") {
      args.density = _dial("--density", eat());
    } else if (a.startsWith("--density=")) {
      args.density = _dial("--density", a.slice("--density=".length));
    } else {
      positionals.push(a);
    }
  }
  if (!manifestSet) {
    process.stderr.write("the following arguments are required: --manifest\n");
    process.exit(2);
  }
  if (op === "search" || op === "ground") {
    if (positionals.length === 0) {
      process.stderr.write("the following arguments are required: query\n");
      process.exit(2);
    }
    args.query = positionals[0];
  }
  if ((op === "search" || op === "ground") && args.retriever !== null && args.retriever !== void 0) {
    const r = args.retriever;
    if (!["bm25", "structured", "hybrid"].includes(r)) {
      process.stderr.write(
        `argument --retriever: invalid choice: '${r}' (choose from 'bm25', 'structured', 'hybrid')
`
      );
      process.exit(2);
    }
  }
  return args;
}
async function main(argv = null) {
  const args = _parseArgs(argv ?? process.argv.slice(2));
  try {
    if (args.op === "validate") {
      const raw = JSON.parse(fs4.readFileSync(args.manifest, "utf-8"));
      const errors = validate_manifest(raw);
      if (errors.length > 0) {
        process.stdout.write("INVALID manifest:\n");
        for (const err of errors) {
          process.stdout.write(`  - ${err}
`);
        }
        return 1;
      }
      process.stdout.write("OK \u2014 manifest satisfies contract v1\n");
      return 0;
    }
    const manifest = load_manifest(args.manifest);
    if (args.hasRetriever && args.retriever) {
      manifest.retriever = args.retriever;
    }
    if (args.op === "search") {
      let result;
      if (args.stack) {
        result = search_stack(
          manifest,
          args.query,
          args.stack,
          args.max_results ?? 3,
          _filtersOrNull(_parse_filters(args.filter))
        );
      } else {
        result = search_domain(
          manifest,
          args.query,
          args.domain ?? null,
          args.max_results,
          _filtersOrNull(_parse_filters(args.filter))
        );
      }
      process.stdout.write(
        (args.json ? _jsonDumps(result, 2) : _format_search(result)) + "\n"
      );
      return _truthy(result.error) ? 1 : 0;
    }
    const context = args.context ? JSON.parse(args.context) : {};
    const grounded = await ground(manifest, args.query, context, {
      variance: args.variance ?? null,
      motion: args.motion ?? null,
      density: args.density ?? null
    });
    if (args.persist) {
      const info = persist_grounding(
        grounded,
        args.persist,
        args.project_name ?? null,
        args.page ?? null
      );
      grounded.persisted = info;
    }
    if (args.json) {
      process.stdout.write(_jsonDumps(grounded, 2) + "\n");
    } else {
      process.stdout.write(_render_markdown(grounded) + "\n");
    }
    return 0;
  } catch (exc) {
    if (_isExpected(exc)) {
      process.stderr.write(`Error: ${_errText(exc)}
`);
      return 1;
    }
    throw exc;
  }
}
function _isExpected(exc) {
  if (exc instanceof ManifestError) {
    return true;
  }
  if (exc instanceof SyntaxError) {
    return true;
  }
  if (exc instanceof Error) {
    const code = exc.code;
    if (code && /^E[A-Z]+$/u.test(code)) {
      return true;
    }
  }
  return false;
}
function _errText(exc) {
  if (exc instanceof Error) {
    return exc.message;
  }
  return String(exc);
}
function _truthy(value) {
  if (value === null || value === void 0 || value === false) {
    return false;
  }
  if (typeof value === "string") {
    return value.length > 0;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === "object") {
    return Object.keys(value).length > 0;
  }
  return true;
}
function _str(value) {
  if (value === null || value === void 0) {
    return "None";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }
  if (value instanceof PyFloat) {
    return Number.isInteger(value.value) ? `${value.value}.0` : String(value.value);
  }
  return String(value);
}
function _orStr(a, b) {
  return _truthy(a) ? _str(a) : _str(b);
}
function _confScore2(score) {
  if (score instanceof PyFloat) {
    return Number.isInteger(score.value) ? `${score.value}.0` : String(score.value);
  }
  if (score === void 0 || score === null) {
    return "None";
  }
  return String(score);
}
function _filtersOrNull(filters) {
  return Object.keys(filters).length > 0 ? filters : null;
}
function _repr2(s) {
  const hasSingle = s.includes("'");
  const hasDouble = s.includes('"');
  if (hasSingle && !hasDouble) {
    return `"${s.replace(/\\/g, "\\\\")}"`;
  }
  return `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}
function _jsonDumps(value, indent) {
  return _dumps(value, indent, 0);
}
function _dumps(value, indent, depth) {
  const pad = " ".repeat(indent * (depth + 1));
  const closePad = " ".repeat(indent * depth);
  if (value === null || value === void 0) {
    return "null";
  }
  if (value instanceof PyFloat) {
    return _jsonFloat(value.value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    return _jsonNum(value);
  }
  if (typeof value === "string") {
    return _jsonStr(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }
    const items = value.map((v) => pad + _dumps(v, indent, depth + 1));
    return `[
${items.join(",\n")}
${closePad}]`;
  }
  if (typeof value === "object") {
    const obj = value;
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      return "{}";
    }
    const items = keys.map(
      (k) => `${pad}${_jsonStr(k)}: ${_dumps(obj[k], indent, depth + 1)}`
    );
    return `{
${items.join(",\n")}
${closePad}}`;
  }
  return _jsonStr(String(value));
}
function _jsonNum(n) {
  if (!Number.isFinite(n)) {
    if (Number.isNaN(n)) {
      return "NaN";
    }
    return n > 0 ? "Infinity" : "-Infinity";
  }
  return String(n);
}
function _jsonFloat(n) {
  if (!Number.isFinite(n)) {
    if (Number.isNaN(n)) {
      return "NaN";
    }
    return n > 0 ? "Infinity" : "-Infinity";
  }
  if (Number.isInteger(n)) {
    return `${n}.0`;
  }
  return String(n);
}
function _jsonStr(s) {
  let out = '"';
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
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
          out += `\\u${code.toString(16).padStart(4, "0")}`;
        } else {
          out += ch;
        }
    }
  }
  return `${out}"`;
}
function _isCliEntry() {
  if (process.argv[1] === void 0) {
    return false;
  }
  const argvUrl = pathToFileURL2(path3.resolve(process.argv[1])).href;
  if (import.meta.url === argvUrl) {
    return true;
  }
  try {
    const here = fs4.realpathSync(fileURLToPath(import.meta.url));
    const argv = fs4.realpathSync(path3.resolve(process.argv[1]));
    return here === argv;
  } catch {
    return false;
  }
}
var _isMain = _isCliEntry();
if (_isMain) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}
`);
    process.exitCode = 1;
  });
}
export {
  main
};
