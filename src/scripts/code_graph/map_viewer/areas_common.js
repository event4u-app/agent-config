/*
 * The knowledge areas beside Code share one page: a bar with the breadcrumb,
 * the area's views and what its reader saw; the main column; and a detail rail
 * listing the picked item's witnesses with their confirm state. An area whose
 * reader did not run is shown with "no data yet" and the reason, never hidden.
 *
 * Each area file registers a module in AREA_MODULES:
 *   tabs    [[id, stringKey], …] — the views; a 'findings' view is drawn here
 *   items   (payload) → [{ key, kind, label, sub, rows, witnesses }] — every
 *           pickable fact; search, the detail rail and the Overview read these
 *   meta    (payload) → the one-line summary in the bar
 *   render  (payload, view, main) — draws one view
 */
extendStrings({
    en: {
        areaNames: { overview: 'Overview', code: 'Code', data: 'Data', interfaces: 'Interfaces', runtime: 'Runtime', delivery: 'Delivery', impact: 'Impact', agent: 'Agent' },
        navLabel: 'Areas', noDataYet: 'No data yet', willShow: 'What this area shows once its reader ran',
        foundNothing: function (r) { return r + ' ran and found nothing'; }, reader: 'reader', completenessL: 'completeness',
        lowerBound: 'partial read — every count is a lower bound', unknownRead: 'unknown coverage — every count is a lower bound',
        confirmNames: { confirmed: 'confirmed', moved: 'moved', changed: 'changed', gone: 'gone', added: 'added', unconfirmed: 'index only' },
        confirmHelp: { confirmed: 'the span still hashes the same', moved: 'the same span, at another line', changed: 'the span at that line reads differently now', gone: 'the span is no longer in the file', added: 'in the working tree, not yet in the index', unconfirmed: 'not re-read since the index was built' },
        completeNames: { complete: 'complete', partial: 'partial', unknown: 'unknown' },
        sevNames: { high: 'high', medium: 'medium', low: 'low', info: 'info' },
        rungNames: { T1: 'T1 code / migration', T2: 'T2 committed dump / contract', T3: 'T3 user snapshot', T4: 'T4 framework oracle' },
        witnesses: 'Witnesses', aFindings: 'Findings', pickItem: 'Pick an item to see its witnesses and their confirm state.', noFindings: 'No findings.',
        topFindings: 'Findings first', detail: 'Detail', confirmLegend: 'Confirm state per witness:', colSubject: 'Subject', colRule: 'Rule', colSeverity: 'Severity',
        colMessage: 'Finding', colWitness: 'Witness', views: 'View', moreRows: function (n) { return '+ ' + n + ' more rows'; }, hashT: 'hash of the span as read',
        bannerStale: { behind: function (n) { return 'The graph is ' + n + ' commit(s) behind HEAD'; }, edited: 'An indexed file has uncommitted edits', absent: 'No graph index was found', other: function (s) { return 'Graph state: ' + s; } },
        bannerWhy: { behind: 'Facts may describe code that has changed since. Confirm a witness before acting on it, or redraw with `agent-config code-graph map`.', edited: 'The map shows the committed version of those files; confirm the witnesses you act on.', absent: 'Nothing on this map was read from an index; every fact is unverifiable.', other: 'Confirm a witness before acting on it.' },
        bannerLabel: 'Freshness'
    },
    de: {
        areaNames: { overview: 'Übersicht', code: 'Code', data: 'Data', interfaces: 'Interfaces', runtime: 'Runtime', delivery: 'Delivery', impact: 'Impact', agent: 'Agent' },
        navLabel: 'Ebenen', noDataYet: 'Noch keine Daten', willShow: 'Was diese Ebene zeigt, sobald ihr Leser gelaufen ist',
        foundNothing: function (r) { return r + ' ist gelaufen und hat nichts gefunden'; }, reader: 'Leser', completenessL: 'Vollständigkeit',
        lowerBound: 'teilweise gelesen — jede Zahl ist eine Untergrenze', unknownRead: 'Abdeckung unbekannt — jede Zahl ist eine Untergrenze',
        confirmNames: { confirmed: 'bestätigt', moved: 'verschoben', changed: 'geändert', gone: 'weg', added: 'neu', unconfirmed: 'nur Index' },
        confirmHelp: { confirmed: 'die Stelle hat noch denselben Hash', moved: 'dieselbe Stelle, in anderer Zeile', changed: 'die Stelle in dieser Zeile liest sich jetzt anders', gone: 'die Stelle ist nicht mehr in der Datei', added: 'im Arbeitsbaum, noch nicht im Index', unconfirmed: 'seit dem Index nicht neu gelesen' },
        completeNames: { complete: 'vollständig', partial: 'teilweise', unknown: 'unbekannt' },
        sevNames: { high: 'hoch', medium: 'mittel', low: 'niedrig', info: 'info' },
        rungNames: { T1: 'T1 Code / Migration', T2: 'T2 eingecheckter Dump / Vertrag', T3: 'T3 Snapshot des Nutzers', T4: 'T4 Framework-Orakel' },
        witnesses: 'Nachweise', aFindings: 'Befunde', pickItem: 'Eintrag wählen, um seine Nachweise und deren Bestätigung zu sehen.', noFindings: 'Keine Befunde.',
        topFindings: 'Befunde zuerst', detail: 'Detail', confirmLegend: 'Bestätigung je Nachweis:', colSubject: 'Gegenstand', colRule: 'Regel', colSeverity: 'Schwere',
        colMessage: 'Befund', colWitness: 'Nachweis', views: 'Ansicht', moreRows: function (n) { return '+ ' + n + ' weitere Zeilen'; }, hashT: 'Hash der Stelle beim Lesen',
        bannerStale: { behind: function (n) { return 'Der Graph liegt ' + n + ' Commit(s) hinter HEAD'; }, edited: 'Eine indizierte Datei hat nicht committete Änderungen', absent: 'Es wurde kein Graph-Index gefunden', other: function (s) { return 'Graph-Zustand: ' + s; } },
        bannerWhy: { behind: 'Fakten können Code beschreiben, der sich seither geändert hat. Vor dem Handeln einen Nachweis bestätigen oder mit `agent-config code-graph map` neu zeichnen.', edited: 'Die Karte zeigt die committete Fassung dieser Dateien; die Nachweise bestätigen, auf die du dich stützt.', absent: 'Nichts auf dieser Karte stammt aus einem Index; jeder Fakt ist unüberprüfbar.', other: 'Vor dem Handeln einen Nachweis bestätigen.' },
        bannerLabel: 'Frische'
    }
});

extendStrings({
    en: {
        areaTitle: { data: 'Data · tables, keys, relations', interfaces: 'Interfaces · services and operations', runtime: 'Runtime · infrastructure and environments', delivery: 'Delivery · local environment and pipelines', impact: 'Impact · what a change reaches', agent: 'Agent · verbs and context pack' },
        areaWhat: {
            data: 'Tables, columns, keys and delete rules from migrations and models; ORM relations beside real foreign keys; drift between code, intended and actual schema — each fact with the file and line it was read from.',
            interfaces: 'External services the code calls, their operations and parameters, the configuration names they are bound through, every call site, and drift against a contract in the tree.',
            runtime: 'Infrastructure resources from IaC files, which environment declares them, services with their images, ports and networks, and drift such as port collisions.',
            delivery: 'Workflows and jobs with their needs, the environments they deploy to, and the build → image → deploy chain.',
            impact: 'For a working diff: the affected code, tests, columns, operations, resources and pipelines, each with its confirm state, and the review-risk terms.',
            agent: 'The graph verbs an agent calls — each with the question it answers and its CLI and MCP name — and the context pack it receives before it acts.'
        },
        noReader: {
            data: 'No schema reader ran on this tree: migrations, models and SQL dumps are not read into map.json yet.',
            interfaces: 'No interface reader ran: HTTP clients, SOAP, GraphQL, gRPC and the contracts in the tree are not read into map.json yet.',
            runtime: 'No runtime reader ran: Compose files, Dockerfiles, Terraform and Kubernetes manifests are not read into map.json yet.',
            delivery: 'No delivery reader ran: CI workflows are not read into map.json yet.',
            impact: 'No change preview was written: this map was drawn without a working diff to preview.',
            agent: 'No agent payload was written: the verb list and the context pack are not read into map.json yet.'
        }
    },
    de: {
        areaTitle: { data: 'Data · Tabellen, Schlüssel, Beziehungen', interfaces: 'Interfaces · Dienste und Operationen', runtime: 'Runtime · Infrastruktur und Umgebungen', delivery: 'Delivery · lokale Umgebung und Pipelines', impact: 'Impact · was eine Änderung erreicht', agent: 'Agent · Verben und Context-Pack' },
        areaWhat: {
            data: 'Tabellen, Spalten, Schlüssel und Löschregeln aus Migrationen und Models; ORM-Beziehungen neben echten Fremdschlüsseln; Drift zwischen Code, geplantem und tatsächlichem Schema — jeder Fakt mit Datei und Zeile, aus der er gelesen wurde.',
            interfaces: 'Externe Dienste, die der Code aufruft, ihre Operationen und Parameter, die Konfigurationsnamen, über die sie gebunden sind, jede Aufrufstelle und Drift gegen einen Vertrag im Baum.',
            runtime: 'Infrastruktur-Ressourcen aus IaC-Dateien, welche Umgebung sie deklariert, Dienste mit Images, Ports und Netzen, und Drift wie Port-Kollisionen.',
            delivery: 'Workflows und Jobs mit ihren needs, die Umgebungen, in die sie ausrollen, und die Kette Build → Image → Deploy.',
            impact: 'Für einen Arbeits-Diff: betroffener Code, Tests, Spalten, Operationen, Ressourcen und Pipelines, jeweils mit Bestätigungszustand, und die Review-Risiko-Terme.',
            agent: 'Die Graph-Verben, die ein Agent aufruft — jedes mit der Frage, die es beantwortet, und seinem CLI- und MCP-Namen — und das Context-Pack, das er vor dem Handeln bekommt.'
        },
        noReader: {
            data: 'Auf diesem Baum ist kein Schema-Leser gelaufen: Migrationen, Models und SQL-Dumps werden noch nicht in map.json gelesen.',
            interfaces: 'Kein Schnittstellen-Leser ist gelaufen: HTTP-Clients, SOAP, GraphQL, gRPC und die Verträge im Baum werden noch nicht in map.json gelesen.',
            runtime: 'Kein Runtime-Leser ist gelaufen: Compose-Dateien, Dockerfiles, Terraform und Kubernetes-Manifeste werden noch nicht in map.json gelesen.',
            delivery: 'Kein Delivery-Leser ist gelaufen: CI-Workflows werden noch nicht in map.json gelesen.',
            impact: 'Es wurde keine Änderungsvorschau geschrieben: Diese Karte wurde ohne Arbeits-Diff gezeichnet.',
            agent: 'Es wurde kein Agent-Payload geschrieben: Verbliste und Context-Pack werden noch nicht in map.json gelesen.'
        }
    }
});

var AREA_MODULES = Object.create(null);
var KNOWLEDGE_IDS = ['data', 'interfaces', 'runtime', 'delivery', 'impact', 'agent'];
var ROW_CAP = 200;
var avState = { view: Object.create(null), pin: null, fly: false };

var CONFIRM_CLASS = { confirmed: 'ok', moved: 'cyan', changed: 'warn', gone: 'bad', added: 'violet', unconfirmed: 'dash' };
var SEV_CLASS = { high: 'bad', medium: 'warn', low: 'dash', info: 'cyan' };
var COMPLETE_CLASS = { complete: 'ok', partial: 'warn', unknown: 'dash' };

function stChip(text, cls, title) { return el('span', { class: 'st ' + (cls || 'dash'), title: title || null }, text); }
function confirmChip(state) { return stChip(t('confirmNames')[state] || state, CONFIRM_CLASS[state], t('confirmHelp')[state] || ''); }
function wloc(w) { return w.file + ':' + w.line; }
function kvGrid(rows) {
    var g = el('div', { class: 'kv mono' });
    rows.forEach(function (r) {
        if (r[1] == null || r[1] === '') return;
        g.appendChild(el('span', { class: 'muted' }, r[0]));
        g.appendChild(typeof r[1] === 'object' ? r[1] : el('span', null, String(r[1])));
    });
    return g;
}
function witnessList(ws) {
    var ul = el('ul', { class: 'wits' });
    ws.forEach(function (w) {
        var li = el('li');
        add(li, el('span', { class: 'mono wloc', title: wloc(w) }, wloc(w)), confirmChip(w.confirm),
            el('span', { class: 'mono muted', title: t('hashT') }, '#' + String(w.hash).slice(0, 8)),
            w.rung ? el('span', { class: 'mono muted', title: t('rungNames')[w.rung] || w.rung }, w.rung) : null);
        ul.appendChild(li);
    });
    return ul;
}

/** All pickable facts of an area, the findings among them, keyed for the URL. */
function areaItems(id) {
    var p = KA[id];
    var mod = AREA_MODULES[id];
    if (!p || !mod || p.empty) return [];
    var out = mod.items(p);
    (p.findings || []).forEach(function (f, i) {
        out.push({ key: 'finding/' + i, kind: 'finding', label: f.id + ' · ' + f.subject, sub: f.message, finding: f,
            rows: [[t('colRule'), f.id], [t('colSeverity'), stChip(t('sevNames')[f.severity] || f.severity, SEV_CLASS[f.severity])], [t('colSubject'), f.subject], ['engine', f.engine], [t('completenessL'), t('completeNames')[f.completeness]]],
            witnesses: f.witnesses || [] });
    });
    return out;
}
function itemByKey(id, key) {
    var list = areaItems(id);
    for (var i = 0; i < list.length; i++) if (list[i].key === key) return list[i];
    return null;
}
/** Witness confirm states over an area, for the Overview bar. */
function confirmCounts(id) {
    var c = { confirmed: 0, moved: 0, changed: 0, gone: 0, added: 0, unconfirmed: 0, total: 0 };
    areaItems(id).forEach(function (it) {
        if (it.kind === 'finding') return;
        it.witnesses.forEach(function (w) { if (c[w.confirm] !== undefined) { c[w.confirm] += 1; c.total += 1; } });
    });
    return c;
}

/** A table whose rows open their item; long tables are cut with a line that says so. */
function factTable(id, headers, rows) {
    var wrap = el('div', { class: 'tblwrap' });
    var tb = el('table', { class: 'tbl' });
    var thead = el('tr');
    headers.forEach(function (h) { thead.appendChild(el('th', null, h)); });
    tb.appendChild(add(el('thead'), thead));
    var body = el('tbody');
    rows.slice(0, ROW_CAP).forEach(function (r) {
        var tr = el('tr', { class: r.cls || '' });
        r.cells.forEach(function (c, k) {
            var td = el('td');
            if (k === 0 && r.key) {
                var b = el('button', { type: 'button', class: 'rowpick' + (current.item === r.key ? ' on' : '') }, null);
                if (typeof c === 'object') b.appendChild(c); else b.textContent = String(c);
                b.addEventListener('click', function () { avPick(id, r.key); });
                td.appendChild(b);
            } else if (c != null && typeof c === 'object') td.appendChild(c);
            else td.textContent = c == null ? '–' : String(c);
            tr.appendChild(td);
        });
        body.appendChild(tr);
    });
    tb.appendChild(body);
    wrap.appendChild(tb);
    if (rows.length > ROW_CAP) wrap.appendChild(el('span', { class: 'note-line' }, t('moreRows')(num(rows.length - ROW_CAP))));
    return wrap;
}
function findingsView(id, main) {
    var p = KA[id];
    var list = p.findings || [];
    if (!list.length) { main.appendChild(el('div', { class: 'box' }, t('noFindings'))); return; }
    main.appendChild(factTable(id, [t('colRule'), t('colSeverity'), t('colSubject'), t('colMessage'), t('colWitness')], list.map(function (f, i) {
        var w = f.witnesses && f.witnesses[0];
        return { key: 'finding/' + i, cells: [f.id, stChip(t('sevNames')[f.severity] || f.severity, SEV_CLASS[f.severity]), f.subject, f.message, w ? add(el('span', { class: 'mono' }, wloc(w) + ' '), confirmChip(w.confirm)) : '–'] };
    })));
}

function avPick(id, key) { location.hash = '#/' + id + (key ? '/' + encodeURIComponent(key) : ''); }

function avCrumbs(id, item) {
    var c = el('nav', { class: 'crumbs av-crumbs', 'aria-label': 'Breadcrumb' });
    function link(text, fn) { var b = el('button', { type: 'button' }, text); if (fn) b.addEventListener('click', fn); else b.disabled = true; return b; }
    c.appendChild(link(t('crumbMap'), id === 'overview' ? null : function () { go('overview'); }));
    if (id !== 'overview') {
        c.appendChild(el('span', { 'aria-hidden': 'true' }, '›'));
        c.appendChild(link(t('areaNames')[id], item ? function () { avPick(id, ''); } : null));
    }
    if (item) {
        c.appendChild(el('span', { 'aria-hidden': 'true' }, '›'));
        c.appendChild(link(item.label, null));
    }
    return c;
}

function noDataCard(id) {
    var p = KA[id];
    var card = el('section', { class: 'card empty-card', id: 'nodata-' + id });
    var head = add(el('div', { class: 'between' }), el('b', null, p ? t('foundNothing')(p.reader) : t('noDataYet')), el('span', { class: 'nodata-tag' }, t('noDataShort')));
    add(card, head, el('p', { class: 'reason' }, p ? p.empty : t('noReader')[id]),
        el('span', { class: 'cap' }, t('willShow')), el('p', null, t('areaWhat')[id]));
    return card;
}

function applyAvPanes() {
    var body = $('av-body');
    var mode = paneMode();
    var pinned = mode !== 'phone' && (avState.pin !== null ? avState.pin : mode === 'wide');
    var noSide = body.classList.contains('no-side');
    body.className = 'av-body mode-' + mode + (noSide ? ' no-side' : '') + (pinned ? ' pin-right' : avState.fly ? ' fly-right' : '');
    $('av-scrim').hidden = noSide || pinned || !avState.fly;
    var pin = $('av-pin');
    pin.setAttribute('aria-pressed', String(pinned));
    pin.textContent = pinned ? t('unpin') : t('pin');
    $('av-open').textContent = t('openRight');
    $('av-close').setAttribute('aria-label', t('closePane'));
}

function renderAvDetail(id, item) {
    var d = $('av-detail');
    clear(d);
    var p = KA[id];
    if (!item) {
        var pad = add(el('div', { class: 'pad' }), el('span', { class: 'soft' }, t('pickItem')));
        var fl = (p && p.findings) || [];
        if (fl.length) {
            pad.appendChild(el('span', { class: 'cap' }, t('topFindings')));
            var ul = el('ul', { class: 'plist' });
            fl.slice(0, 8).forEach(function (f, i) {
                var b = el('button', { type: 'button' });
                add(b, stChip(t('sevNames')[f.severity] || f.severity, SEV_CLASS[f.severity]), el('span', { class: 'fname' }, f.id + ' · ' + f.subject));
                b.addEventListener('click', function () { avPick(id, 'finding/' + i); });
                ul.appendChild(add(el('li'), b));
            });
            pad.appendChild(ul);
        }
        d.appendChild(pad);
        return;
    }
    var head = add(el('div', { class: 'fhead' }), add(el('div', { class: 'fhead-top' }), el('div', { class: 'fn' }, item.label)));
    var x = el('button', { type: 'button', class: 'deselect', 'aria-label': t('deselect'), title: t('deselect') }, '×');
    x.addEventListener('click', function () { avPick(id, ''); });
    head.firstChild.appendChild(x);
    head.appendChild(add(el('div', { class: 'chips' }), el('span', { class: 'c-cyan' }, item.kind)));
    if (item.sub) head.appendChild(el('div', { class: 'fp' }, item.sub));
    d.appendChild(head);
    if (item.rows && item.rows.length) d.appendChild(add(el('section', { class: 'sec' }), kvGrid(item.rows)));
    var sw = add(el('section', { class: 'sec' }), add(el('div', { class: 'sec-h' }), el('span', null, t('witnesses') + ' (' + item.witnesses.length + ')')));
    sw.appendChild(item.witnesses.length ? witnessList(item.witnesses) : el('span', { class: 'note-line' }, t('none')));
    d.appendChild(sw);
    if (item.kind !== 'finding') {
        var related = ((p && p.findings) || []).map(function (f, i) { return [f, i]; }).filter(function (fi) {
            return fi[0].subject === item.label || fi[0].subject.indexOf(item.label + '.') === 0 ||
                (fi[0].witnesses || []).some(function (w) { return item.witnesses.some(function (v) { return v.file === w.file && v.line === w.line; }); });
        });
        if (related.length) {
            var sf = add(el('section', { class: 'sec' }), add(el('div', { class: 'sec-h' }), el('span', null, t('aFindings') + ' (' + related.length + ')')));
            related.forEach(function (fi) {
                var b = el('button', { type: 'button', class: 'frow' });
                add(b, stChip(t('sevNames')[fi[0].severity] || fi[0].severity, SEV_CLASS[fi[0].severity]), el('span', null, fi[0].id + ' · ' + fi[0].message));
                b.addEventListener('click', function () { avPick(id, 'finding/' + fi[1]); });
                sf.appendChild(b);
            });
            d.appendChild(sf);
        }
    }
}

/** One knowledge area page: its bar, its main column, and the detail rail. */
function renderAreaPage(id, key) {
    var bar = $('av-bar');
    var main = $('av-main');
    clear(bar);
    clear(main);
    var p = KA[id];
    var mod = AREA_MODULES[id];
    var live = !!(p && mod && !p.empty);
    var item = live && key ? itemByKey(id, key) : null;
    bar.appendChild(avCrumbs(id, item));
    var row = el('div', { class: 'av-row' });
    row.appendChild(el('h1', { class: 'av-title' }, t('areaTitle')[id]));
    if (live) {
        var view = avState.view[id] || mod.tabs[0][0];
        var tabs = el('div', { class: 'lenses', role: 'tablist', 'aria-label': t('views') });
        mod.tabs.forEach(function (o) {
            var b = el('button', { type: 'button', role: 'tab', class: 'lens', 'aria-selected': String(view === o[0]) }, t(o[1]));
            b.addEventListener('click', function () { avState.view[id] = o[0]; renderAreaPage(id, key); });
            tabs.appendChild(b);
        });
        row.appendChild(tabs);
    }
    bar.appendChild(row);
    if (p) {
        var meta2 = add(el('div', { class: 'av-meta mono' }), el('span', null, t('reader') + ': ' + p.reader), stChip(t('completeNames')[p.completeness] || p.completeness, COMPLETE_CLASS[p.completeness]));
        if (live) meta2.appendChild(el('span', null, mod.meta(p)));
        if (p.completeness !== 'complete') meta2.appendChild(el('span', { class: 'muted' }, p.completeness === 'partial' ? t('lowerBound') : t('unknownRead')));
        bar.appendChild(meta2);
    }
    var body = $('av-body');
    body.classList.toggle('no-side', !live);
    if (!live) main.appendChild(noDataCard(id));
    else {
        var legend = el('div', { class: 'av-legend' });
        legend.appendChild(el('span', { class: 'muted' }, t('confirmLegend')));
        ['confirmed', 'moved', 'changed', 'gone', 'added', 'unconfirmed'].forEach(function (s) { legend.appendChild(confirmChip(s)); });
        main.appendChild(legend);
        var v = avState.view[id] || mod.tabs[0][0];
        if (v === 'findings') findingsView(id, main);
        else mod.render(p, v, main);
    }
    renderAvDetail(id, item);
    if (item) avState.fly = true;
    applyAvPanes();
}
