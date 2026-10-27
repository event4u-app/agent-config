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
 *   extra   () → true when the area has facts to show from ANOTHER area's
 *           payload (Delivery's local environment reads Runtime's services);
 *           then the area is live without a payload of its own, `tabsFor`
 *           (payload) narrows the views, and `extraItems` () adds the picks
 */
extendStrings({
    en: {
        areaNames: { overview: 'Overview', code: 'Code', data: 'Data', systems: 'Systems', interfaces: 'Interfaces', runtime: 'Runtime', delivery: 'Delivery', bugs: 'Bugs', knowledge: 'Knowledge', impact: 'Impact', agent: 'Agent', projects: 'Projects' },
        navNoData: 'no data yet in the real map', navBugsLocal: 'Bug data is local – never in the committed map',
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
        areaNames: { overview: 'Übersicht', code: 'Code', data: 'Data', systems: 'Systeme', interfaces: 'Interfaces', runtime: 'Runtime', delivery: 'Delivery', bugs: 'Bugs', knowledge: 'Wissen', impact: 'Impact', agent: 'Agent', projects: 'Projekte' },
        navNoData: 'noch keine Daten in der echten Map', navBugsLocal: 'Bug-Daten sind lokal – nie in der committeten Map',
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
        areaTitle: { data: 'Data · tables, keys, relations', systems: 'Systems · runtimes, frameworks, packages', interfaces: 'Interfaces · services and operations', runtime: 'Runtime · infrastructure and environments', delivery: 'Delivery · local environment and pipelines', impact: 'Impact · what a change reaches', agent: 'Agent · verbs and context pack', projects: 'Projects · this machine', bugs: 'Bugs & Fixes · local', knowledge: 'Knowledge · sources, memory, decisions' },
        areaWhat: {
            data: 'Tables, columns, keys and delete rules from migrations and models; ORM relations beside real foreign keys; drift between code, intended and actual schema — each fact with the file and line it was read from.',
            systems: 'Runtimes with every witness side by side, frameworks and packages in their locked versions, why each package is installed, which files use it, uses without an import, and drift such as an unused or undeclared package.',
            interfaces: 'External services the code calls, their operations and parameters, the configuration names they are bound through, every call site, and drift against a contract in the tree.',
            runtime: 'Infrastructure resources from IaC files, which environment declares them, services with their images, ports and networks, and drift such as port collisions.',
            delivery: 'Workflows and jobs with their needs, the environments they deploy to, and the build → image → deploy chain.',
            impact: 'For a working diff: the affected code, tests, columns, operations, resources and pipelines, each with its confirm state, and the review-risk terms.',
            agent: 'The graph verbs an agent calls — each with the question it answers and its CLI and MCP name — and the context pack it receives before it acts.',
            bugs: 'Bugs from the local bug lane — status, source, environment, cause, the fix commits and the commit that may have introduced each one. Local only: never written into the committed map.',
            knowledge: 'Every knowledge source of the repository — Markdown, ADRs, roadmaps, contracts, memory stores — who owns it, whether the map reads it, and the decisions and sessions it holds.',
            projects: 'The projects registered on this machine, the links between them, host ports two of them publish, images and services they share, and which call of one lands on a route of another — names and paths only, never in a project map.'
        },
        noReader: {
            data: 'No schema reader ran on this tree: migrations, models and SQL dumps are not read into map.json yet.',
            systems: 'No systems reader ran: lockfiles, manifests, version files and images are not read into map.json yet.',
            interfaces: 'No interface reader ran: HTTP clients, SOAP, GraphQL, gRPC and the contracts in the tree are not read into map.json yet.',
            runtime: 'No runtime reader ran: Compose files, Dockerfiles, Terraform and Kubernetes manifests are not read into map.json yet.',
            delivery: 'No delivery reader ran: CI workflows are not read into map.json yet.',
            impact: 'No change preview was written: this map was drawn without a working diff to preview.',
            agent: 'No agent payload was written: the verb list and the context pack are not read into map.json yet.',
            bugs: 'No bug lane in this map: bug data is read locally into .build/bugs/ and never reaches the committed map.',
            knowledge: 'No knowledge source index was written: stores, owners, read-by and decisions are not read into map.json yet.',
            projects: 'No project is registered on this machine yet: a `code-graph build` or `code-graph projects add <path>` registers one.'
        }
    },
    de: {
        areaTitle: { data: 'Data · Tabellen, Schlüssel, Beziehungen', systems: 'Systeme · Runtimes, Frameworks, Pakete', interfaces: 'Interfaces · Dienste und Operationen', runtime: 'Runtime · Infrastruktur und Umgebungen', delivery: 'Delivery · lokale Umgebung und Pipelines', impact: 'Impact · was eine Änderung erreicht', agent: 'Agent · Verben und Context-Pack', projects: 'Projekte · dieser Rechner', bugs: 'Bugs & Fixes · lokal', knowledge: 'Wissen · Quellen, Memory, Entscheidungen' },
        areaWhat: {
            data: 'Tabellen, Spalten, Schlüssel und Löschregeln aus Migrationen und Models; ORM-Beziehungen neben echten Fremdschlüsseln; Drift zwischen Code, geplantem und tatsächlichem Schema — jeder Fakt mit Datei und Zeile, aus der er gelesen wurde.',
            systems: 'Runtimes mit jedem Nachweis nebeneinander, Frameworks und Pakete in ihrer gelockten Version, warum jedes Paket installiert ist, welche Dateien es nutzen, Nutzungen ohne Import und Drift wie ungenutzte oder nicht deklarierte Pakete.',
            interfaces: 'Externe Dienste, die der Code aufruft, ihre Operationen und Parameter, die Konfigurationsnamen, über die sie gebunden sind, jede Aufrufstelle und Drift gegen einen Vertrag im Baum.',
            runtime: 'Infrastruktur-Ressourcen aus IaC-Dateien, welche Umgebung sie deklariert, Dienste mit Images, Ports und Netzen, und Drift wie Port-Kollisionen.',
            delivery: 'Workflows und Jobs mit ihren needs, die Umgebungen, in die sie ausrollen, und die Kette Build → Image → Deploy.',
            impact: 'Für einen Arbeits-Diff: betroffener Code, Tests, Spalten, Operationen, Ressourcen und Pipelines, jeweils mit Bestätigungszustand, und die Review-Risiko-Terme.',
            agent: 'Die Graph-Verben, die ein Agent aufruft — jedes mit der Frage, die es beantwortet, und seinem CLI- und MCP-Namen — und das Context-Pack, das er vor dem Handeln bekommt.',
            bugs: 'Bugs aus der lokalen Bug-Lane — Status, Quelle, Umgebung, Ursache, die Fix-Commits und der Commit, der jeden vermutlich eingeführt hat. Nur lokal: nie in die committete Map geschrieben.',
            knowledge: 'Jede Wissensquelle des Repositories — Markdown, ADRs, Roadmaps, Verträge, Memory-Stores — wem sie gehört, ob die Map sie liest, und die Entscheidungen und Sessions darin.',
            projects: 'Die auf diesem Rechner registrierten Projekte, die Verbindungen zwischen ihnen, Host-Ports, die zwei von ihnen veröffentlichen, gemeinsame Images und Dienste, und welcher Aufruf des einen auf einer Route des anderen landet — nur Namen und Pfade, nie in einer Projekt-Map.'
        },
        noReader: {
            data: 'Auf diesem Baum ist kein Schema-Leser gelaufen: Migrationen, Models und SQL-Dumps werden noch nicht in map.json gelesen.',
            systems: 'Kein Systems-Leser ist gelaufen: Lockfiles, Manifeste, Versionsdateien und Images werden noch nicht in map.json gelesen.',
            interfaces: 'Kein Schnittstellen-Leser ist gelaufen: HTTP-Clients, SOAP, GraphQL, gRPC und die Verträge im Baum werden noch nicht in map.json gelesen.',
            runtime: 'Kein Runtime-Leser ist gelaufen: Compose-Dateien, Dockerfiles, Terraform und Kubernetes-Manifeste werden noch nicht in map.json gelesen.',
            delivery: 'Kein Delivery-Leser ist gelaufen: CI-Workflows werden noch nicht in map.json gelesen.',
            impact: 'Es wurde keine Änderungsvorschau geschrieben: Diese Karte wurde ohne Arbeits-Diff gezeichnet.',
            agent: 'Es wurde kein Agent-Payload geschrieben: Verbliste und Context-Pack werden noch nicht in map.json gelesen.',
            bugs: 'Keine Bug-Lane in dieser Map: Bug-Daten werden lokal nach .build/bugs/ gelesen und erreichen die committete Map nie.',
            knowledge: 'Es wurde kein Wissensquellen-Index geschrieben: Stores, Besitzer, Leser und Entscheidungen werden noch nicht in map.json gelesen.',
            projects: 'Auf diesem Rechner ist noch kein Projekt registriert: `code-graph build` oder `code-graph projects add <Pfad>` registriert eines.'
        }
    }
});

var AREA_MODULES = Object.create(null);
var KNOWLEDGE_IDS = ['data', 'systems', 'interfaces', 'runtime', 'delivery', 'impact', 'agent'];
/** The nav of a project map in the handover's order; Bugs and Wissen are routes without a reader of their own yet. */
var NAV_ROUTES = ['overview', 'code', 'data', 'systems', 'interfaces', 'runtime', 'delivery', 'bugs', 'knowledge', 'impact', 'agent'];
var ROW_CAP = 200;
var avState = { view: Object.create(null), pin: null, fly: false, pinL: null, flyL: false };

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
    if (!mod) return [];
    var out = mod.extraItems ? mod.extraItems() : [];
    if (!p || p.empty) return out;
    out = out.concat(mod.items(p));
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
                if (typeof c === 'object') b.appendChild(c); else { b.textContent = String(c); b.title = String(c); }
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
        var ws = f.witnesses || [];
        var cell = ws.length ? el('div', { class: 'wcell' }) : '–';
        ws.forEach(function (w) { cell.appendChild(add(el('div', { class: 'mono' }, wloc(w) + ' '), confirmChip(w.confirm))); });
        return { key: 'finding/' + i, cells: [f.id, stChip(t('sevNames')[f.severity] || f.severity, SEV_CLASS[f.severity]), f.subject, f.message, cell] };
    })));
}

function avPick(id, key) { location.hash = '#/' + id + (key ? '/' + encodeURIComponent(key) : ''); }

function avCrumbs(id, item) {
    var c = el('nav', { class: 'crumbs av-crumbs', 'aria-label': 'Breadcrumb' });
    function link(text, fn) { var b = el('button', { type: 'button' }, text); if (fn) b.addEventListener('click', fn); else b.disabled = true; return b; }
    c.appendChild(link(t('crumbMap'), id === HOME ? null : function () { go(HOME); }));
    if (id !== HOME) {
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

function isAvPinned(side) {
    var mode = paneMode();
    var p = side === 'left' ? avState.pinL : avState.pin;
    return mode !== 'phone' && (p !== null ? p : mode === 'wide');
}
/** Both rails of an area page: pinned beside the centre on a wide window, a flyout with a scrim below it, never pinned on a phone. */
function applyAvPanes() {
    var body = $('av-body');
    var mode = paneMode();
    var noSide = body.classList.contains('no-side');
    var noLeft = body.classList.contains('no-left');
    var paged = body.classList.contains('paged');
    var pinR = isAvPinned('right');
    var pinL = isAvPinned('left');
    var c = 'av-body mode-' + mode + (noSide ? ' no-side' : '') + (noLeft ? ' no-left' : '') + (paged ? ' paged' : '');
    c += pinR ? ' pin-right' : avState.fly ? ' fly-right' : '';
    c += pinL ? ' pin-left' : avState.flyL ? ' fly-left' : '';
    body.className = c;
    var flyOpen = (!noSide && !pinR && avState.fly) || (!noLeft && !pinL && avState.flyL);
    $('av-scrim').hidden = !flyOpen;
    [['av-pin', pinR], ['av-pin-left', pinL]].forEach(function (b) {
        var pin = $(b[0]);
        pin.setAttribute('aria-pressed', String(b[1]));
        pin.textContent = b[1] ? t('unpin') : t('pin');
    });
    var titles = avRailTitles();
    $('av-open').textContent = (titles[1] || t('openRight').replace(/\s*☰$/, '')) + ' ☰';
    $('av-open-left').textContent = '☰ ' + (titles[0] || '');
    $('av-close').setAttribute('aria-label', t('closePane'));
    $('av-close-left').setAttribute('aria-label', t('closePane'));
}
var avRailTitleKeys = [null, 'detail'];
function avRailTitles() { return avRailTitleKeys.map(function (k) { return k ? t(k) : null; }); }
/** Opening one flyout closes the other: the centre is never covered twice. */
function avFly(side, open) {
    if (side === 'left') { avState.flyL = open; if (open) avState.fly = false; } else { avState.fly = open; if (open) avState.flyL = false; }
    applyAvPanes();
}

/** The view tablist an area page draws; a module that owns its bar puts this into it. */
function viewTabs(id, key, tabList) {
    var view = avState.view[id];
    var tabs = el('div', { class: 'lenses', role: 'tablist', 'aria-label': t('views') });
    tabList.forEach(function (o) {
        var b = el('button', { type: 'button', role: 'tab', class: 'lens', 'aria-selected': String(view === o[0]) }, t(o[1]));
        b.addEventListener('click', function () { avState.view[id] = o[0]; renderAreaPage(id, key); });
        tabs.appendChild(b);
    });
    return tabs;
}
/** One rail section with its capitalised head and an optional count beside it. */
function railSection(title, count) {
    var sec = el('section', { class: 'rsec' });
    var h = add(el('div', { class: 'rsec-h' }), el('span', { class: 'cap' }, title));
    if (count != null) h.appendChild(el('span', { class: 'mono muted' }, String(count)));
    sec.appendChild(h);
    return sec;
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
    var links = item.links ? item.links() : [];
    if (links.length) {
        var sl = add(el('section', { class: 'sec' }), add(el('div', { class: 'sec-h' }), el('span', null, t('links') + ' (' + links.length + ')')));
        links.forEach(function (l) {
            var b = el('button', { type: 'button', class: 'frow link', title: l[1].go ? t('openCode') : t('notOnMap'), disabled: !l[1].go });
            add(b, el('span', { class: 'muted' }, l[0]), el('span', { class: 'mono' }, l[1].label), l[1].sub ? el('span', { class: 'mono muted' }, l[1].sub) : null);
            if (l[1].go) b.addEventListener('click', l[1].go);
            sl.appendChild(b);
        });
        d.appendChild(sl);
    }
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

/** The reader line of an area: which reader ran, how complete, what it saw. */
function areaMetaLine(id, own) {
    var p = KA[id];
    var mod = AREA_MODULES[id];
    if (!p) return null;
    var m = add(el('div', { class: 'av-meta mono' }), el('span', null, t('reader') + ': ' + p.reader), stChip(t('completeNames')[p.completeness] || p.completeness, COMPLETE_CLASS[p.completeness]));
    if (own) m.appendChild(el('span', null, mod.meta(p)));
    if (p.completeness !== 'complete') m.appendChild(el('span', { class: 'muted' }, p.completeness === 'partial' ? t('lowerBound') : t('unknownRead')));
    return m;
}

/**
 * The rail open buttons are the shell's, but a page lends them to its bar or
 * head row, which the next render clears. Held by reference from the first
 * render on and handed back to the area body before anything is cleared, so no
 * route ever looks them up after they were dropped with a cleared row.
 */
var shellOwned = null;
function releaseShellNodes() {
    if (!shellOwned) shellOwned = [$('av-open-left'), $('av-open')];
    shellOwned.forEach(function (n) { $('av-body').appendChild(n); });
}

/** The compact reader line of a page head: the module's own summary first, then completeness; the reader's name is its tooltip. */
function pageMetaLine(id, own) {
    var p = KA[id];
    var mod = AREA_MODULES[id];
    if (!p) return null;
    var m = el('div', { class: 'av-meta av-barmeta mono', title: t('reader') + ': ' + p.reader });
    if (own) m.appendChild(el('span', null, mod.meta(p)));
    var lower = p.completeness === 'partial' ? t('lowerBound') : p.completeness === 'unknown' ? t('unknownRead') : null;
    m.appendChild(stChip(t('completeNames')[p.completeness] || p.completeness, COMPLETE_CLASS[p.completeness], lower));
    return m;
}

/**
 * One knowledge area page. A module with `page` lays out both rails and the
 * centre itself: page(payload|null, view, key, { bar, left, main, right });
 * one without it gets the bar, the main column and the witness detail rail.
 */
function renderAreaPage(id, key) {
    var bar = $('av-bar');
    var main = $('av-main');
    var body = $('av-body');
    releaseShellNodes();
    clear(bar);
    clear(main);
    clear($('av-left-body'));
    clear($('av-right-body'));
    var p = KA[id];
    var mod = AREA_MODULES[id];
    var own = !!(p && mod && !p.empty);
    var live = own || !!(mod && mod.extra && mod.extra());
    var tabList = !mod ? [] : mod.tabsFor ? mod.tabsFor(own ? p : null) : mod.tabs;
    var item = live && key ? itemByKey(id, key) : null;
    if (live && tabList.length && !tabList.some(function (o) { return o[0] === avState.view[id]; })) avState.view[id] = tabList[0][0];
    var paged = !!(mod && mod.page);
    avRailTitleKeys = paged && mod.railTitles ? mod.railTitles : [null, 'detail'];
    $('av-left-title').textContent = avRailTitleKeys[0] ? t(avRailTitleKeys[0]) : '';
    $('av-right-title').textContent = avRailTitleKeys[1] ? t(avRailTitleKeys[1]) : '';
    body.classList.toggle('no-left', !paged || !avRailTitleKeys[0]);
    body.classList.toggle('no-side', !live || (paged && !avRailTitleKeys[1]));
    body.classList.toggle('paged', paged);
    $('av-detail').hidden = paged;
    $('av-right-body').hidden = !paged;
    if (paged) {
        bar.hidden = false;
        var centre = main;
        if (!mod.ownsBar) {
            // One row as the designs draw it: the views on the left, what the reader saw on the right.
            var head = el('div', { class: 'av-head' });
            if (live && tabList.length) head.appendChild(viewTabs(id, key, tabList));
            var m = pageMetaLine(id, own);
            if (m) head.appendChild(m);
            main.appendChild(head);
            centre = el('div', { class: 'av-page' });
            main.appendChild(centre);
        }
        if (!live) {
            centre.appendChild(noDataCard(id));
            var why = p ? p.empty : t('noReader')[id];
            if (avRailTitleKeys[0]) $('av-left-body').appendChild(add(el('div', { class: 'pad' }), el('span', { class: 'nodata-tag' }, t('noDataShort')), el('p', { class: 'reason' }, why)));
        } else mod.page(own ? p : null, avState.view[id], key, { bar: bar, left: $('av-left-body'), main: centre, right: $('av-right-body') });
        // The open buttons sit at the ends of whichever row heads the page, so a flown rail stays reachable.
        var ends = mod.ownsBar ? bar : main.firstChild;
        ends.insertBefore($('av-open-left'), ends.firstChild);
        ends.appendChild($('av-open'));
        bar.classList.toggle('owned', !!mod.ownsBar);
        bar.hidden = !mod.ownsBar;
        if (item) avFly('right', true); else applyAvPanes();
        avRailButtons();
        return;
    }
    bar.classList.remove('owned');
    bar.hidden = false;
    bar.appendChild(avCrumbs(id, item));
    var row = el('div', { class: 'av-row' });
    row.appendChild(el('h1', { class: 'av-title' }, t('areaTitle')[id]));
    if (live) row.appendChild(viewTabs(id, key, tabList));
    bar.appendChild(row);
    var meta2 = areaMetaLine(id, own);
    if (meta2) bar.appendChild(meta2);
    if (live && mod.metaExtra && mod.extra()) bar.appendChild(add(el('div', { class: 'av-meta mono' }), el('span', null, mod.metaExtra())));
    if (!live) main.appendChild(noDataCard(id));
    else {
        var legend = el('div', { class: 'av-legend' });
        legend.appendChild(el('span', { class: 'muted' }, t('confirmLegend')));
        ['confirmed', 'moved', 'changed', 'gone', 'added', 'unconfirmed'].forEach(function (s) { legend.appendChild(confirmChip(s)); });
        main.appendChild(legend);
        var v = avState.view[id];
        if (v === 'findings' && mod.renderFindings && own) mod.renderFindings(p, main);
        else if (v === 'findings') findingsView(id, main);
        else mod.render(own ? p : null, v, main);
    }
    renderAvDetail(id, item);
    if (item) avState.fly = true;
    applyAvPanes();
    avRailButtons();
}
/** The open buttons show only for a rail that exists and is not pinned. */
function avRailButtons() {
    var body = $('av-body');
    var l = $('av-open-left');
    var r = $('av-open');
    l.classList.toggle('gone', body.classList.contains('no-left') || isAvPinned('left'));
    r.classList.toggle('gone', body.classList.contains('no-side') || isAvPinned('right'));
}
