/*
 * Overview: the map's home. One card per knowledge layer with when it was
 * indexed, whether a witness was re-read since, how much it covers and how many
 * findings it holds — or that no reader ran, and why. The state is derived from
 * the data on this page only.
 */
extendStrings({
    en: {
        oTitle: 'What does AC know – and how sure is it?',
        oIntro: 'The graph is an index, not the truth. Each layer shows when it was indexed, when its source was last checked and how much it covers. Without a complete scan the answer is "unknown", never "missing".',
        oManifest: 'manifest', oCommit: 'commit', oGeneration: 'generation', oExport: 'export', oNoGlobal: 'without global data ✓',
        oStateLegend: 'State per fact', oRungLegend: 'Provenance:', oRungs: 'T1 code · T2 dump/contract · T3 snapshot · T4 oracle', oFilters: { all: 'All layers', data: 'With data', planned: 'Planned · empty' },
        oDrawn: function (c, st) { var m = /^behind:(\d+)$/.exec(st); return 'Drawn at ' + c + (st === 'fresh' ? ', the graph is level with HEAD.' : m ? ', HEAD is ' + m[1] + ' commits ahead.' : ', graph state: ' + st + '.'); },
        oSnapFacts: 'The facts hold for the snapshot. Redraw: ', oWitnesses: function (n, r) { return n + ' witnesses · ' + r + ' re-read'; },
        oIndexed: 'indexed', oConfirmed: 'source checked', oCoverage: 'coverage', oFindings: 'findings', oNever: 'never (index only)',
        oBadge: { live: 'active', empty: 'read, empty', none: 'no data yet', scope: 'own scope', markdown: 'Markdown only', local: 'local only' },
        oLayer: { code: 'Code', data: 'Database', systems: 'Systems', interfaces: 'Integrations', env: 'Environment', ci: 'CI/CD', infra: 'Infrastructure', knowledge: 'Knowledge · Memory', impact: 'Impact', bugs: 'Bugs & Fixes', projects: 'Projects' },
        oWhat: {
            data: 'Tables, columns, FKs from code (C), migration (M), live (L), query (Q)', systems: 'Runtimes, frameworks, packages – why installed, where used', interfaces: 'REST, SOAP, GraphQL, webhooks, queues – callers, contracts, DTOs',
            env: 'Docker, Compose, ports, networks – declared vs. observed', ci: 'Workflows, jobs, needs, conditions (true/false/unknown)',
            infra: 'Terraform/HCL, plan, resources, review/stage/prod', knowledge: 'Docs, ADRs, memory, decisions, sessions, ways of working – who owns what',
            impact: 'Change preview across every layer with an evidence report', bugs: 'Open and fixed bugs, fix commits, regression paths through the graph', projects: 'Other projects – only in the global viewer, never in this file'
        },
        oBranchDiff: 'Branch differences:', oBranch: { code: 'files, symbols', data: 'tables, columns', systems: 'direct packages, versions', impact: 'working tree against HEAD', none: 'no branch facts' },
        oWarnEmpty: function (f, n, fx) { return 'Manifest: “empty”, but ' + f + ' facts and ' + n + ' findings' + (fx ? ' (test fixtures)' : '') + '.'; },
        oRanEmpty: function (r, why) { return r + ' ran and found nothing' + (why ? ': ' + why : ''); },
        oKnowCovMd: function (n) { return n + ' Markdown · memory, JSONL, sessions not read'; }, oKnowReader: 'Doc nodes from Markdown · memory, decision facts and sessions missing',
        oBugsReader: 'bugs lane (Stage H) planned · error events carry personal data – so never in this file, not even counts', oProjReader: 'Hub on this machine · never in git',
        states: { fresh: 'fresh', stale: 'stale', contradicted: 'contradicted', unverifiable: 'unverifiable', incomplete: 'incomplete' },
        stateWhy: {
            fresh: 'the graph is level with HEAD', stale: 'the graph is behind the working tree', unverifiable: 'no graph index was found',
            contradicted: function (n) { return n + ' witness(es) changed or gone since they were read'; }, incomplete: 'the reader saw only part of its population'
        },
        oCodeWhat: function (f, e, g) { return f + ' files · ' + e + ' trusted edges · ' + g + ' guessed'; }, oCodeCov: function (l, p) { return l + ' languages · ' + p + ' providers'; },
        oProviders: function (v, p) { return v + ' verified, ' + p + ' providers partial'; }, oGraphWide: 'freshness holds for the whole graph',
        oConfirmedShare: function (a, b) { return a + ' of ' + b; }, oLocalOptIn: 'local, opt-in',
        oGate: 'Reliability baseline · Gate G0', oGateChip: 'Blocks new layers', oGateNote: 'No phase moves on while R1–R6 are not filed with a reproducer, commit and regression test.',
        oGates: ['Laravel model User is skipped (MODEL_BASES contains "User")', 'Three migration readers contradict each other', 'Drops and renames not modelled',
            'FK index assumed independent of the engine', 'HTTP calls mapped wrongly (Http::post → Comment::post)', 'Edges collected but not used for queries'],
        oGateWhy: 'no reliability record: the map does not carry the state of R1–R6',
        oTours: 'Tours', oStepStale: 'input changed', oProtocol: 'Check protocol before every change',
        oSteps: ['Candidates from the index – never completeness', 'Resolve the scope: commit, tenant, connection, environment, API version', 'Read the fresh source',
            'Search independently: rg, AST, dynamic places', 'Reconcile: confirmed · stale · contradictory · inaccessible · ambiguous', 'Change and test in a targeted way',
            'Regenerate only the touched layers, the rest keeps its badge']
    },
    de: {
        oTitle: 'Was weiß AC – und wie sicher?',
        oIntro: 'Der Graph ist ein Index, keine Wahrheit. Jede Ebene zeigt, wann sie indiziert wurde, wann die Quelle zuletzt geprüft wurde und wie viel sie abdeckt. Ohne vollständigen Scan heißt es „unbekannt“, nie „fehlt“.',
        oManifest: 'manifest', oCommit: 'commit', oGeneration: 'generation', oExport: 'export', oNoGlobal: 'ohne globale Daten ✓',
        oStateLegend: 'Zustand je Fakt', oRungLegend: 'Herkunft:', oRungs: 'T1 Code · T2 Dump/Vertrag · T3 Snapshot · T4 Orakel', oFilters: { all: 'Alle Ebenen', data: 'Mit Daten', planned: 'Geplant · leer' },
        oDrawn: function (c, st) { var m = /^behind:(\d+)$/.exec(st); return 'Gezeichnet bei ' + c + (st === 'fresh' ? ', der Graph steht auf HEAD.' : m ? ', HEAD ist ' + m[1] + ' Commits weiter.' : ', Graph-Zustand: ' + st + '.'); },
        oSnapFacts: 'Die Fakten gelten für den Snapshot. Neu zeichnen: ', oWitnesses: function (n, r) { return n + ' Zeugen · ' + r + ' erneut gelesen'; },
        oIndexed: 'indiziert', oConfirmed: 'Quelle geprüft', oCoverage: 'Abdeckung', oFindings: 'Befunde', oNever: 'nie (nur Index)',
        oBadge: { live: 'aktiv', empty: 'gelesen, leer', none: 'noch keine Daten', scope: 'eigener Scope', markdown: 'nur Markdown', local: 'nur lokal' },
        oLayer: { code: 'Code', data: 'Datenbank', systems: 'Systeme', interfaces: 'Integrations', env: 'Environment', ci: 'CI/CD', infra: 'Infrastruktur', knowledge: 'Wissen · Memory', impact: 'Impact', bugs: 'Bugs & Fixes', projects: 'Projects' },
        oWhat: {
            data: 'Tabellen, Spalten, FKs aus Code (C), Migration (M), Live (L), Query (Q)', systems: 'Runtimes, Frameworks, Pakete – warum installiert, wo genutzt', interfaces: 'REST, SOAP, GraphQL, Webhooks, Queues – Aufrufer, Verträge, DTOs',
            env: 'Docker, Compose, Ports, Netze – deklariert vs. beobachtet', ci: 'Workflows, Jobs, needs, Bedingungen (wahr/falsch/unbekannt)',
            infra: 'Terraform/HCL, Plan, Ressourcen, review/stage/prod', knowledge: 'Doku, ADRs, Memory, Entscheidungen, Sessions, Arbeitsweise – wem gehört was',
            impact: 'Änderungsvorschau über jede Ebene mit Nachweisbericht', bugs: 'Offene und behobene Bugs, Fix-Commits, Regressionspfade durch den Graphen', projects: 'Andere Projekte – nur im globalen Viewer, nie in dieser Datei'
        },
        oBranchDiff: 'Branch-Unterschiede:', oBranch: { code: 'Dateien, Symbole', data: 'Tabellen, Spalten', systems: 'direkte Pakete, Versionen', impact: 'Arbeitsbaum gegen HEAD', none: 'keine Branch-Fakten' },
        oWarnEmpty: function (f, n, fx) { return 'Manifest: „empty“, aber ' + f + ' Fakten und ' + n + ' Befunde' + (fx ? ' (Test-Fixtures)' : '') + '.'; },
        oRanEmpty: function (r, why) { return r + ' lief und fand nichts' + (why ? ': ' + why : ''); },
        oKnowCovMd: function (n) { return n + ' Markdown · Memory, JSONL, Sessions nicht gelesen'; }, oKnowReader: 'Doku-Knoten aus Markdown · Memory, Entscheidungs-Fakten und Sessions fehlen',
        oBugsReader: 'bugs lane (Stage H) geplant · Fehler-Events tragen Personendaten – darum nie in dieser Datei, nicht einmal Zählwerte', oProjReader: 'Hub auf diesem Rechner · nie im Git',
        states: { fresh: 'fresh', stale: 'stale', contradicted: 'contradicted', unverifiable: 'unverifiable', incomplete: 'incomplete' },
        stateWhy: {
            fresh: 'der Graph ist auf HEAD-Stand', stale: 'der Graph liegt hinter dem Arbeitsbaum', unverifiable: 'es wurde kein Graph-Index gefunden',
            contradicted: function (n) { return n + ' Nachweis(e) geändert oder weg, seit sie gelesen wurden'; }, incomplete: 'der Leser hat nur einen Teil seiner Grundgesamtheit gesehen'
        },
        oCodeWhat: function (f, e, g) { return f + ' Dateien · ' + e + ' sichere Kanten · ' + g + ' geraten'; }, oCodeCov: function (l, p) { return l + ' Sprachen · ' + p + ' Provider'; },
        oProviders: function (v, p) { return v + ' verifiziert, ' + p + ' Provider teilweise'; }, oGraphWide: 'gilt für den ganzen Graphen',
        oConfirmedShare: function (a, b) { return a + ' von ' + b; }, oLocalOptIn: 'lokal, opt-in',
        oGate: 'Reliability-Baseline · Gate G0', oGateChip: 'Blocker für neue Ebenen', oGateNote: 'Keine Phase rückt vor, solange R1–R6 nicht mit Reproducer, Commit und Regressionstest eingeordnet sind.',
        oGates: ['Laravel-Model User wird übersprungen (MODEL_BASES enthält "User")', 'Drei Migrations-Leser widersprechen sich', 'Drops und Renames nicht modelliert',
            'FK-Index unabhängig von der Engine angenommen', 'HTTP-Aufrufe falsch zugeordnet (Http::post → Comment::post)', 'Kanten gesammelt, aber nicht für Abfragen genutzt'],
        oGateWhy: 'kein Reliability-Datensatz: die Karte trägt den Stand von R1–R6 nicht',
        oTours: 'Touren', oStepStale: 'Eingabe geändert', oProtocol: 'Prüf-Protokoll vor jeder Änderung',
        oSteps: ['Kandidaten aus dem Index – nie Vollständigkeit', 'Scope auflösen: Commit, Tenant, Connection, Umgebung, API-Version', 'Frische Quelle lesen',
            'Unabhängig suchen: rg, AST, dynamische Stellen', 'Abgleichen: confirmed · stale · contradictory · inaccessible · ambiguous', 'Ändern und gezielt testen',
            'Nur berührte Ebenen neu erzeugen, Rest bleibt mit Badge']
    }
});

var STATE_CLASS = { fresh: 'ok', stale: 'warn', contradicted: 'bad', unverifiable: 'dash', incomplete: 'amberline' };
var STATE_GLYPH = { fresh: '●', stale: '◐', contradicted: '✕', unverifiable: '?', incomplete: '◌' };
var ovFilter = 'all';

/** The freshness of the whole graph, as one of the fact states. */
function graphFactState() {
    var st = String((model.pin && model.pin.freshness) || meta.state || '');
    if (st === 'fresh') return 'fresh';
    if (st === 'absent' || st === '') return 'unverifiable';
    return 'stale';
}
/** A day written the reader's way: `26.10.2026` or `10/26/2026`; `short` drops the year. */
function shortDate(iso, short) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m) return String(iso || '');
    if (lang === 'de') return m[3] + '.' + m[2] + '.' + (short ? '' : m[1]);
    return Number(m[2]) + '/' + Number(m[3]) + (short ? '' : '/' + m[1]);
}
function shortCommit(c) { return String(c || '').slice(0, 8); }

/**
 * The pickable items of an area, plus the Compose services: Runtime stores them
 * but lists only resources, and Delivery shows them as the local environment.
 */
function layerItems(area) {
    var list = areaItems(area);
    if (area !== 'runtime') return list;
    return list.concat(localServices().map(function (s) { return { key: 'service/' + s.name, label: s.name, witnesses: [s.witness] }; }));
}
/** Witness confirm counts over the items an Overview layer covers; `prefix` narrows an area to one kind of item. */
function layerCounts(area, prefix) {
    var c = { confirmed: 0, moved: 0, changed: 0, gone: 0, added: 0, unconfirmed: 0, total: 0 };
    layerItems(area).forEach(function (it) {
        if (it.kind === 'finding' || (prefix && it.key.indexOf(prefix) !== 0)) return;
        it.witnesses.forEach(function (w) { if (c[w.confirm] !== undefined) { c[w.confirm] += 1; c.total += 1; } });
    });
    return c;
}
function factState(counts, payload) {
    var off = counts.changed + counts.gone;
    if (off) return ['contradicted', t('stateWhy').contradicted(num(off))];
    if (payload && payload.completeness !== 'complete') return ['incomplete', t('stateWhy').incomplete];
    var g = graphFactState();
    return [g, t('stateWhy')[g]];
}

/**
 * The eleven layer cards of the handover. Each names the area it opens and
 * where its facts come from: a whole payload, or the part of one that holds the
 * layer's kind of item. `branch` is what the layer can tell apart between
 * branches; `planned` cards have no data in a map file by design.
 */
var OV_LAYERS = [
    { key: 'code', route: 'code', branch: 'code' },
    { key: 'data', route: 'data', area: 'data', branch: 'data' },
    { key: 'systems', route: 'systems', area: 'systems', branch: 'systems' },
    { key: 'interfaces', route: 'interfaces', area: 'interfaces' },
    { key: 'env', route: 'delivery', area: 'runtime', prefix: 'service/', ids: ['service'] },
    { key: 'ci', route: 'delivery', area: 'delivery' },
    { key: 'infra', route: 'runtime', area: 'runtime', prefix: 'resource/', ids: ['resource'] },
    { key: 'knowledge', route: 'knowledge' },
    { key: 'impact', route: 'impact', area: 'impact', branch: 'impact' },
    { key: 'bugs', route: 'bugs', planned: true },
    { key: 'projects', planned: true }
];

function ovRows(indexed, verified, coverage, findings) {
    var g = el('div', { class: 'okv mono' });
    [[t('oIndexed'), indexed], [t('oConfirmed'), verified], [t('oCoverage'), coverage], [t('oFindings'), findings]].forEach(function (r) {
        g.appendChild(el('span', { class: 'muted' }, r[0]));
        var v = typeof r[1] === 'object' ? r[1] : el('span', null, r[1] == null || r[1] === '' ? '–' : String(r[1]));
        g.appendChild(v);
    });
    return g;
}
function never() { var n = el('span', null, t('oNever')); n.style.color = 'var(--amberText)'; return n; }
/** The handover's coverage bar: one fill, green from 90 % on, amber below. */
function ovBar(share) {
    var b = el('div', { class: 'obar' });
    var i = el('div');
    i.style.width = Math.max(0, Math.min(1, share)) * 100 + '%';
    i.style.background = share >= 0.9 ? 'var(--green)' : 'var(--amber)';
    b.appendChild(i);
    return b;
}
function knowledgeShare() {
    var code = 0;
    var known = 0;
    files.forEach(function (f) { if (SCOPE_CODE[f.role]) { code += 1; if (f.knows && f.knows.total) known += 1; } });
    var docs = files.filter(function (f) { return f.role === 'doc'; }).length;
    return { share: code ? known / code : 0, docs: docs };
}
function layerFindings(spec) {
    var p = KA[spec.area];
    if (!p) return [];
    var list = p.findings || [];
    if (!spec.ids) return list;
    var names = Object.create(null);
    layerItems(spec.area).forEach(function (it) { if (it.key.indexOf(spec.prefix) === 0) names[it.label] = true; });
    return list.filter(function (f) { return names[f.subject] || names[String(f.subject).split('.')[0]]; });
}
function layerLive(spec) {
    if (spec.key === 'code') return true;
    if (spec.key === 'knowledge') return knowledgeShare().docs > 0;
    if (spec.planned || !KA[spec.area] || KA[spec.area].empty) return false;
    return !spec.prefix || layerCounts(spec.area, spec.prefix).total > 0;
}
var COMPLETE_SHARE = { complete: 1, partial: 0.5, unknown: 0.25 };
/** A reader's name without its parenthesised list of what it reads: "systems lane". */
function readerName(r) { return String(r || '').split(' (')[0]; }

function ovCard(spec) {
    var key = spec.key;
    var live = layerLive(spec);
    var kind = spec.planned ? 'planned' : live ? 'data' : 'empty';
    var card = el('div', { class: 'card ocard ' + kind, id: 'ov-' + (spec.area && !spec.prefix ? spec.area : key) });
    var title = el(spec.route ? 'a' : 'span', { class: 'otitle' }, t('oLayer')[key]);
    if (spec.route) title.setAttribute('href', '#/' + spec.route);
    var badge = key === 'projects' ? stChip(t('oBadge').scope, 'violetline') : key === 'bugs' ? stChip(t('oBadge').local, 'violetline')
        : key === 'knowledge' && live ? stChip(t('oBadge').markdown, 'ok') : live ? stChip(t('oBadge').live, 'ok') : stChip(t('oBadge')[spec.area && KA[spec.area] ? 'empty' : 'none'], 'dash');
    badge.classList.add('obadge');
    add(card, add(el('div', { class: 'ohead' }), title, badge));
    var pin = model.pin || { commit: meta.commit, date: '' };
    var indexed = shortDate(pin.date, true) || shortCommit(pin.commit);
    var gs = graphFactState();
    var p = spec.area ? KA[spec.area] : null;
    var share = 0;
    var reader = '';
    if (key === 'code') {
        var provs = model.providers || [];
        card.appendChild(el('span', { class: 'what' }, t('oCodeWhat')(num(files.length), num(an.trustedEdges), pct(an.guessShare))));
        card.appendChild(ovRows(indexed, never(), t('oCodeCov')(num((model.languages || []).length), num(provs.length)), num(codeFindingCount())));
        share = 1 - (an.guessShare || 0);
        var verified = provs.filter(function (q) { return q.status === 'verified' || q.status === 'deep'; });
        var partial = provs.filter(function (q) { return q.status === 'partial'; }).length;
        var vText = verified.length <= 2 ? verified.map(function (q) { return q.name; }).join(', ') || '0' : num(verified.length);
        reader = t('oProviders')(vText, num(partial)) + ' · ' + t('states')[gs] + ': ' + t('oGraphWide');
    } else {
        card.appendChild(el('span', { class: 'what' }, t('oWhat')[key]));
        if (key === 'knowledge') {
            var ks = knowledgeShare();
            card.appendChild(ovRows(live ? indexed : '–', '–', live ? t('oKnowCovMd')(num(ks.docs)) : '–', '–'));
            share = ks.share;
            reader = t('oKnowReader');
        } else if (spec.planned) {
            card.appendChild(ovRows(t('oLocalOptIn'), '–', '–', '–'));
            reader = key === 'bugs' ? t('oBugsReader') : t('oProjReader');
        } else if (!live) {
            card.appendChild(ovRows('–', '–', '–', '–'));
            reader = !p ? t('noReader')[spec.area] : t('oRanEmpty')(readerName(p.reader), p.empty);
        } else {
            var c = layerCounts(spec.area, spec.prefix);
            var reread = c.total - c.unconfirmed;
            card.appendChild(ovRows(indexed, reread ? t('oConfirmedShare')(num(reread), num(c.total)) : never(), t('completeNames')[p.completeness], num(layerFindings(spec).length)));
            share = COMPLETE_SHARE[p.completeness] || 0;
            var st = factState(c, p);
            reader = readerName(p.reader) + ' · ' + t('states')[st[0]] + ': ' + st[1];
        }
    }
    card.appendChild(ovBar(share));
    card.appendChild(el('span', { class: 'onote' }, reader));
    // The payload says "empty" yet carries facts or findings: the handover names the contradiction.
    if (p && p.empty) {
        var facts = payloadWitnesses(p, []).length;
        var fl = p.findings || [];
        var fx = fl.length > 0 && fl.every(function (f) { return String(f.subject).indexOf('tests/fixtures/') === 0; });
        if (facts || fl.length) card.appendChild(el('span', { class: 'owarn' }, t('oWarnEmpty')(num(facts), num(fl.length), fx)));
    }
    if (!spec.planned) {
        var known = spec.branch ? t('oBranch')[spec.branch] : t('oBranch').none;
        add(card, add(el('div', { class: 'obranch' }), el('span', null, t('oBranchDiff')), stChip(known, spec.branch && spec.branch !== 'impact' ? 'violet-tint' : 'dash')));
    }
    return card;
}

/** Every witness a payload carries, its findings' included: what the map could re-read. */
function payloadWitnesses(v, out) {
    if (!v || typeof v !== 'object') return out;
    if (Array.isArray(v)) { v.forEach(function (x) { payloadWitnesses(x, out); }); return out; }
    if (typeof v.file === 'string' && typeof v.line === 'number' && v.hash !== undefined) { out.push(v); return out; }
    Object.keys(v).forEach(function (k) { payloadWitnesses(v[k], out); });
    return out;
}
function mapWitnesses() {
    var all = [];
    KNOWLEDGE_IDS.forEach(function (id) { if (KA[id]) payloadWitnesses(KA[id], all); });
    return all;
}
/**
 * The handover's state banner: the freshness as built (Decision D4), the
 * sentence that says what it means, the redraw command, the snapshot chip and
 * how many witnesses the map holds and how many were re-read since.
 */
function ovBanner(pin) {
    var st = String(pin.freshness || meta.state || '');
    var ws = mapWitnesses();
    var reread = ws.filter(function (w) { return w.confirm && w.confirm !== 'unconfirmed'; }).length;
    var b = el('div', { class: 'ov-banner ' + (st === 'fresh' ? 'fresh' : 'behind'), id: 'ov-banner' });
    var text = el('span', { class: 'ov-btext' });
    add(text, el('b', null, t('oDrawn')(shortCommit(pin.commit), st)), document.createTextNode(' '),
        add(el('span', { class: 'soft' }), document.createTextNode(t('oSnapFacts')), el('span', { class: 'mono' }, 'agent-config code-graph refresh'), document.createTextNode('.')));
    add(b, stChip(st, st === 'fresh' ? 'ok' : 'warn'), text, model.branches ? null : stChip(t('snapChip'), 'dash', t('snapChipT')), stChip(t('oWitnesses')(num(ws.length), num(reread)), 'dash'));
    return b;
}

function renderOverview() {
    var main = $('av-main');
    var head = el('div', { class: 'ov-head' });
    add(head, add(el('div', { class: 'ov-intro' }), el('h1', null, t('oTitle')), el('p', { class: 'soft' }, t('oIntro'))));
    var pin = model.pin || { commit: meta.commit, date: '', generation: meta.graph_generation || '' };
    var nog = el('span', null, t('oNoGlobal'));
    nog.style.color = 'var(--greenText)';
    head.appendChild(add(el('div', { class: 'manifest' }), kvGrid([[t('oManifest'), 'manifest.json'], [t('oCommit'), shortCommit(pin.commit) + (pin.date ? ' · ' + shortDate(pin.date) : '')],
        [t('oGeneration'), String(pin.generation || '').slice(0, 8)], [t('oExport'), nog]])));
    main.appendChild(head);

    var legend = add(el('div', { class: 'ov-legend' }), el('b', null, t('oStateLegend')));
    ['fresh', 'stale', 'contradicted', 'unverifiable', 'incomplete'].forEach(function (s) { legend.appendChild(stChip(STATE_GLYPH[s] + ' ' + t('states')[s], STATE_CLASS[s])); });
    var rl = el('span', { class: 'muted' }, t('oRungLegend'));
    rl.style.marginLeft = '8px';
    legend.appendChild(rl);
    legend.appendChild(el('span', { class: 'mono soft', title: ['T1', 'T2', 'T3', 'T4'].map(function (r) { return t('rungNames')[r]; }).join(' · ') }, t('oRungs')));
    // The handover's filter is a radiogroup at the end of the legend row: one choice, not views.
    var radios = el('div', { class: 'ov-filters', role: 'radiogroup', 'aria-label': 'Filter' });
    ['all', 'data', 'planned'].forEach(function (f) {
        var b = el('button', { type: 'button', role: 'radio', class: 'oseg', 'aria-checked': String(ovFilter === f) }, t('oFilters')[f]);
        b.addEventListener('click', function () { ovFilter = f; renderRoute(); });
        radios.appendChild(b);
    });
    legend.appendChild(radios);
    main.appendChild(legend);
    main.appendChild(ovBanner(pin));
    var grid = el('div', { class: 'ogrid' });
    OV_LAYERS.forEach(function (spec) {
        var live = layerLive(spec);
        if (ovFilter === 'data' && !live) return;
        if (ovFilter === 'planned' && live) return;
        grid.appendChild(ovCard(spec));
    });
    main.appendChild(grid);

    var lower = el('div', { class: 'ov-lower' });
    var gate = add(el('section', { class: 'card ogate' }), add(el('div', { class: 'between' }), el('b', null, t('oGate')), stChip(t('oGateChip'), 'bad')));
    var rows = el('div', { class: 'gates' });
    t('oGates').forEach(function (text, i) {
        var tag = el('span', { class: 'nodata-tag', title: t('noDataTitle')(t('oGateWhy')) }, t('noDataShort'));
        rows.appendChild(add(el('div', { class: 'gate' }), el('span', { class: 'mono gid' }, 'R' + (i + 1)), el('span', null, text), tag));
    });
    add(gate, rows, el('span', { class: 'onote' }, t('oGateNote')));
    lower.appendChild(gate);
    var proto = add(el('section', { class: 'card oproto' }), el('b', null, t('oProtocol')));
    var steps = el('ol', { class: 'steps' });
    t('oSteps').forEach(function (s) { steps.appendChild(el('li', null, s)); });
    proto.appendChild(steps);
    lower.appendChild(proto);
    main.appendChild(lower);

    if (KA.tours && KA.tours.length) {
        var tc = add(el('section', { class: 'card otours' }), el('b', null, t('oTours')));
        KA.tours.forEach(function (tour) {
            tc.appendChild(el('span', { class: 'cap' }, tour.title));
            var ol = el('ol', { class: 'tour' });
            tour.steps.forEach(function (s) {
                var b = el('a', { href: '#/' + s.area + (s.item ? '/' + encodeURIComponent(s.item) : ''), class: 'frow' });
                add(b, el('span', null, s.text), s.state === 'stale' ? stChip(t('oStepStale'), 'warn', s.inputHash) : null);
                ol.appendChild(add(el('li'), b));
            });
            tc.appendChild(ol);
        });
        main.appendChild(tc);
    }
}
